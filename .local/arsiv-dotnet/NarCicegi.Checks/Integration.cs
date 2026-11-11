using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using Microsoft.Extensions.Logging.Abstractions;
using MySqlConnector;
using NarCicegi.Api.Database;

static class Integration
{
    public static async Task RunAsync()
    {
        var executable = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "MySQL", "MySQL Server 8.0", "bin", "mysqld.exe");
        if (!File.Exists(executable)) throw new Exception("Entegrasyon denemesi için MySQL Server 8.0 bulunamadı.");
        var root = Path.GetFullPath(".");
        var directory = Path.Combine(root, ".local", "mysql-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(directory);
        var data = Path.Combine(directory, "data");
        var port = FreePort();
        var apiPort = FreePort();
        Process? server = null;
        Process? api = null;
        using var deadline = new CancellationTokenSource(TimeSpan.FromMinutes(2));
        var ct = deadline.Token;
        try
        {
            using (var init = Start(executable, ["--no-defaults", "--initialize-insecure", $"--datadir={data}", "--console"], directory))
            {
                await init.WaitForExitAsync(ct);
                if (init.ExitCode != 0) throw new Exception("Geçici MySQL başlatılamadı; .local/mysql-tests logunu inceleyin.");
            }
            server = StartServer();
            var options = new DatabaseOptions { Port = (uint)port, User = "root", TimeoutSeconds = 2, SslMode = "Disabled" };
            await WaitDatabaseAsync(options, ct);
            var adminConnection = new MySqlConnectionStringBuilder(options.ConnectionString()) { Database = "" };
            await using (var admin = new MySqlConnection(adminConnection.ConnectionString))
            {
                await admin.OpenAsync(ct);
                await using var create = new MySqlCommand("CREATE DATABASE nar_cicegi CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci", admin);
                await create.ExecuteNonQueryAsync(ct);
            }
            await Schema.MigrateAsync(options, ct);
            await Schema.MigrateAsync(options, ct);
            await using (var db = new MySqlConnection(options.ConnectionString()))
            {
                await db.OpenAsync(ct);
                await using var count = new MySqlCommand("SELECT COUNT(*) FROM schema_migrations", db);
                Check(Convert.ToInt32(await count.ExecuteScalarAsync(ct)) == 1, "Şema ikinci çalıştırmada çoğalmıyor");
                await using var name = new MySqlCommand("SELECT JSON_UNQUOTE(JSON_EXTRACT(value_json, '$.name')) FROM application_settings WHERE setting_key='business'", db);
                Check(Convert.ToString(await name.ExecuteScalarAsync(ct)) == "Nar Çiçeği", "Türkçe karakterler MySQL üzerinden korunuyor");
                await using var account = new MySqlCommand("CREATE USER 'runtime_test'@'localhost' IDENTIFIED BY 'integration-only'; GRANT SELECT, INSERT, UPDATE, DELETE ON nar_cicegi.* TO 'runtime_test'@'localhost'", db);
                await account.ExecuteNonQueryAsync(ct);
            }
            options.User = "runtime_test";
            options.Password = "integration-only";
            await using (var runtime = new MySqlConnection(options.ConnectionString()))
            {
                await runtime.OpenAsync(ct);
                try
                {
                    await using var forbidden = new MySqlCommand("CREATE TABLE forbidden_test (id INT)", runtime);
                    await forbidden.ExecuteNonQueryAsync(ct);
                    throw new Exception("Uygulama kullanıcısında DDL yetkisi var");
                }
                catch (MySqlException ex) when (ex.Number == 1142) { Console.WriteLine("OK: Uygulama kullanıcısı tablo oluşturamıyor"); }
            }
            var monitor = new DatabaseMonitor(new MySqlProbe(options), options, NullLogger<DatabaseMonitor>.Instance);
            await monitor.CheckOnceAsync(ct);
            Check(monitor.Status.Ready, "Gerçek MySQL uygulama kullanıcısıyla hazır");

            var dll = Path.Combine(root, "src", "NarCicegi.Api", "bin", "Debug", "net10.0", "NarCicegi.Api.dll");
            var apiStart = Info("dotnet", [dll, "--contentRoot", Path.Combine(root, "src", "NarCicegi.Api")], root);
            apiStart.Environment["NAR_LOCAL_CONFIG"] = "";
            apiStart.Environment["ASPNETCORE_ENVIRONMENT"] = "Production";
            apiStart.Environment["Urls"] = $"http://127.0.0.1:{apiPort}";
            apiStart.Environment["Database__Port"] = port.ToString();
            apiStart.Environment["Database__User"] = options.User;
            apiStart.Environment["Database__Password"] = options.Password;
            apiStart.Environment["Database__SslMode"] = "Disabled";
            apiStart.Environment["Database__CheckIntervalSeconds"] = "2";
            apiStart.Environment["Database__TimeoutSeconds"] = "2";
            api = Launch(apiStart);
            using var client = new HttpClient { BaseAddress = new Uri($"http://127.0.0.1:{apiPort}"), Timeout = TimeSpan.FromSeconds(4) };
            await WaitHttpAsync(client, HttpStatusCode.OK, ct, api);
            Check((await client.GetAsync("/", ct)).IsSuccessStatusCode, "Sistem durumu sayfası HTTP ile sunuluyor");
            Check((await client.GetStringAsync("/api/system/status", ct)).Contains("\"ready\":true"), "Durum API'si gerçek bağlantıyı gösteriyor");

            server.Kill();
            await server.WaitForExitAsync(ct);
            server.Dispose(); server = null;
            await WaitHttpAsync(client, HttpStatusCode.ServiceUnavailable, ct, api);
            Check((await client.GetAsync("/health/live", ct)).StatusCode == HttpStatusCode.OK && !api.HasExited, "MySQL durunca uygulama çalışıyor; readiness 503");
            server = StartServer();
            await WaitHttpAsync(client, HttpStatusCode.OK, ct, api);
            Check(!api.HasExited, "MySQL geri gelince uygulama yeniden başlatılmadan hazır oluyor");
        }
        finally
        {
            foreach (var process in new[] { api, server })
            {
                if (process is null) continue;
                if (!process.HasExited) { process.Kill(); await process.WaitForExitAsync(); }
                process.Dispose();
            }
        }

        Process StartServer() => Start(executable,
            ["--no-defaults", "--no-monitor", $"--datadir={data}", $"--port={port}", "--bind-address=127.0.0.1", "--mysqlx=OFF", "--skip-log-bin", "--console"], directory);
    }

    private static async Task WaitDatabaseAsync(DatabaseOptions options, CancellationToken ct)
    {
        var builder = new MySqlConnectionStringBuilder(options.ConnectionString()) { Database = "" };
        while (true)
        {
            ct.ThrowIfCancellationRequested();
            try { await using var db = new MySqlConnection(builder.ConnectionString); await db.OpenAsync(ct); return; }
            catch (MySqlException) { await Task.Delay(300, ct); }
        }
    }

    private static async Task WaitHttpAsync(HttpClient client, HttpStatusCode expected, CancellationToken ct, Process api)
    {
        while (true)
        {
            ct.ThrowIfCancellationRequested();
            if (api.HasExited) throw new Exception("HTTP hizmeti kontrol tamamlanmadan kapandı.");
            try { using var response = await client.GetAsync("/health/ready", ct); if (response.StatusCode == expected) return; }
            catch (HttpRequestException) { }
            await Task.Delay(300, ct);
        }
    }

    private static ProcessStartInfo Info(string file, string[] args, string cwd)
    {
        var info = new ProcessStartInfo(file) { WorkingDirectory = cwd, UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true };
        foreach (var arg in args) info.ArgumentList.Add(arg);
        return info;
    }
    private static Process Start(string file, string[] args, string cwd) => Launch(Info(file, args, cwd));
    private static Process Launch(ProcessStartInfo info)
    {
        var process = Process.Start(info)!;
        process.OutputDataReceived += (_, e) => { if (info.FileName == "dotnet" && e.Data is not null) Console.WriteLine("API: " + e.Data); };
        process.ErrorDataReceived += (_, e) => { if (info.FileName == "dotnet" && e.Data is not null) Console.WriteLine("API: " + e.Data); };
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();
        return process;
    }
    private static int FreePort() { var listener = new TcpListener(IPAddress.Loopback, 0); listener.Start(); var port = ((IPEndPoint)listener.LocalEndpoint).Port; listener.Stop(); return port; }
    private static void Check(bool ok, string message) { if (!ok) throw new Exception(message); Console.WriteLine("OK: " + message); }
}
