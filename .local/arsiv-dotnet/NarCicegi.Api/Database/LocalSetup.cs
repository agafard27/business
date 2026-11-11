using MySqlConnector;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace NarCicegi.Api.Database;

public static partial class LocalSetup
{
    [GeneratedRegex("^[a-z][a-z0-9_]{0,39}$")]
    private static partial Regex SafeName();

    public static async Task RunAsync(string configPath, DatabaseOptions options, CancellationToken ct)
    {
        if (!OperatingSystem.IsWindows()) throw new InvalidOperationException("Yerel korumalı kurulum Windows gerektirir.");
        if (File.Exists(configPath)) throw new InvalidOperationException("Yerel ayar zaten var. Üzerine yazılmadı.");
        if (File.Exists(configPath + ".pending")) throw new InvalidOperationException("Önceki kurulumun korumalı kurtarma dosyası var. Hesap durumunu doğrulayıp database.json.pending dosyasını database.json olarak kurtarın.");
        if (!SafeName().IsMatch(options.Name) || !SafeName().IsMatch(options.User))
            throw new InvalidOperationException("Veritabanı ve uygulama kullanıcı adı yalnızca küçük harf, rakam ve alt çizgi içerebilir.");

        Console.WriteLine($"Hedef: {options.Host}:{options.Port} / {options.Name}");
        Console.Write("MySQL yönetici kullanıcı adı [root]: ");
        var adminUser = Console.ReadLine();
        Console.Write("MySQL yönetici parolası (gizli giriş): ");
        var adminPassword = ReadPassword();
        var adminOptions = new MySqlConnectionStringBuilder(options.ConnectionString())
        {
            Database = "", UserID = string.IsNullOrWhiteSpace(adminUser) ? "root" : adminUser,
            Password = adminPassword, Pooling = false
        };
        await using var admin = new MySqlConnection(adminOptions.ConnectionString);
        await admin.OpenAsync(ct);
        Console.WriteLine("Yönetici bağlantısı doğrulandı.");

        // A pre-existing account is never silently replaced or granted new permissions.
        await using var exists = new MySqlCommand("SELECT COUNT(*) FROM mysql.user WHERE User = @user AND Host = 'localhost'", admin);
        exists.Parameters.AddWithValue("user", options.User);
        if (Convert.ToInt32(await exists.ExecuteScalarAsync(ct)) != 0)
            throw new InvalidOperationException("Uygulama kullanıcısı zaten var. Mevcut parolayla bağlantı ayarı gerekir; hesap değiştirilmedi.");

        await using (var createDb = new MySqlCommand($"CREATE DATABASE IF NOT EXISTS `{options.Name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci", admin))
            await createDb.ExecuteNonQueryAsync(ct);

        var migrationOptions = new DatabaseOptions
        {
            Host = options.Host, Port = options.Port, Name = options.Name,
            User = adminOptions.UserID, Password = adminPassword, SslMode = options.SslMode
        };
        await Schema.MigrateAsync(migrationOptions, ct);
        Console.WriteLine("Veritabanı şeması doğrulandı.");
        var password = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var protectedPassword = Convert.ToBase64String(ProtectedData.Protect(Encoding.UTF8.GetBytes(password), null, DataProtectionScope.CurrentUser));
        Directory.CreateDirectory(Path.GetDirectoryName(configPath)!);
        var json = JsonSerializer.Serialize(new
        {
            Database = new { options.Host, options.Port, options.Name, options.User, options.SslMode, ProtectedPassword = protectedPassword }
        }, new JsonSerializerOptions { WriteIndented = true });
        // Save recovery credentials before account creation; never lose a generated password.
        var recovery = configPath + ".pending";
        await File.WriteAllTextAsync(recovery, json, ct);
        await using (var createUser = new MySqlCommand($"CREATE USER '{options.User}'@'localhost' IDENTIFIED BY @password", admin))
        {
            createUser.Parameters.AddWithValue("password", password);
            await createUser.ExecuteNonQueryAsync(ct);
        }
        // Runtime cannot create/drop tables, databases, or users.
        await using (var grant = new MySqlCommand($"GRANT SELECT, INSERT, UPDATE, DELETE ON `{options.Name}`.* TO '{options.User}'@'localhost'", admin))
            await grant.ExecuteNonQueryAsync(ct);

        options.Password = password;
        await using (var verify = new MySqlConnection(options.ConnectionString())) await verify.OpenAsync(ct);
        File.Move(recovery, configPath, overwrite: false);
        Console.WriteLine("MySQL veritabanı, şema ve sınırlı uygulama kullanıcısı hazır. Parola Windows hesabınızla korundu.");
    }

    private static string ReadPassword()
    {
        if (Console.IsInputRedirected) throw new InvalidOperationException("Parola etkileşimli terminalde girilmeli.");
        var value = new StringBuilder();
        while (true)
        {
            var key = Console.ReadKey(intercept: true);
            if (key.Key == ConsoleKey.Enter) { Console.WriteLine(); return value.ToString(); }
            if (key.Key == ConsoleKey.Backspace) { if (value.Length > 0) value.Length--; }
            else if (!char.IsControl(key.KeyChar)) value.Append(key.KeyChar);
        }
    }
}
