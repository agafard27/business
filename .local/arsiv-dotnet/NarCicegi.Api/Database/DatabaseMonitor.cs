using System.Diagnostics;
using MySqlConnector;

namespace NarCicegi.Api.Database;

public sealed record DatabaseStatus(string State, string Message, DateTimeOffset? CheckedAtUtc = null,
    DateTimeOffset? LastSuccessAtUtc = null, long? LatencyMs = null, int? SchemaVersion = null)
{
    public bool Ready => State == "ready";
}

public interface IDatabaseProbe
{
    Task<(int Version, bool TablesPresent)> CheckAsync(CancellationToken ct);
}

public sealed class MySqlProbe(DatabaseOptions options) : IDatabaseProbe
{
    public async Task<(int Version, bool TablesPresent)> CheckAsync(CancellationToken ct)
    {
        // Use a fresh, bounded connection for health checks. A broken pooled socket must not
        // prevent the monitor from detecting a restarted server.
        var settings = new MySqlConnectionStringBuilder(options.ConnectionString()) { Pooling = false };
        await using var connection = new MySqlConnection(settings.ConnectionString);
        await connection.OpenAsync(ct);
        await using var command = new MySqlCommand("SELECT COALESCE(MAX(version), 0) FROM schema_migrations", connection);
        var version = Convert.ToInt32(await command.ExecuteScalarAsync(ct));
        await using var tables = new MySqlCommand("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN ('schema_migrations', 'application_settings')", connection);
        return (version, Convert.ToInt32(await tables.ExecuteScalarAsync(ct)) == 2);
    }
}

public sealed class DatabaseMonitor(IDatabaseProbe probe, DatabaseOptions options, ILogger<DatabaseMonitor> logger) : BackgroundService
{
    private DatabaseStatus _status = new("starting", "Veritabanı kontrol ediliyor.");
    public DatabaseStatus Status
    {
        get
        {
            var status = Volatile.Read(ref _status);
            var staleAfter = TimeSpan.FromSeconds(Math.Clamp(options.CheckIntervalSeconds, 2, 300) + Math.Clamp(options.TimeoutSeconds, 1, 30) * 2 + 5);
            return status.Ready && DateTimeOffset.UtcNow - status.CheckedAtUtc > staleAfter
                ? status with { State = "stale", Message = "Veritabanı kontrolü gecikti. Güncel bağlantı doğrulanamadı." }
                : status;
        }
    }

    public async Task CheckOnceAsync(CancellationToken ct)
    {
        var previous = Status;
        var started = Stopwatch.StartNew();
        DatabaseStatus next;
        try
        {
            var result = await probe.CheckAsync(ct);
            var ready = result.Version == Schema.Version && result.TablesPresent;
            next = new(ready ? "ready" : "schema_required",
                ready ? "MySQL bağlantısı ve şema hazır." : "Veritabanı şeması uygulamayla uyumlu değil. Kurulum/güncelleme gerekiyor.",
                DateTimeOffset.UtcNow, ready ? DateTimeOffset.UtcNow : previous.LastSuccessAtUtc,
                started.ElapsedMilliseconds, result.Version);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
        catch (MySqlException ex)
        {
            var (state, message) = ex.Number switch
            {
                1045 => ("access_denied", "MySQL kullanıcı adı, parola veya erişim yetkisi doğrulanamadı."),
                1049 => ("database_missing", "Veritabanı bulunamadı. İlk kurulum gerekiyor."),
                1146 => ("schema_required", "Veritabanı şeması eksik. Şema kurulumu gerekiyor."),
                _ => ("unavailable", "MySQL bağlantısı kullanılamıyor. Otomatik yeniden kontrol edilecek.")
            };
            next = new(state, message, DateTimeOffset.UtcNow, previous.LastSuccessAtUtc);
            if (previous.State != state) logger.LogWarning("Database state {State}; MySQL code {Code}", state, ex.Number);
        }
        catch (Exception ex)
        {
            // Never expose connection strings, provider errors or credentials in HTTP responses/logs.
            next = new("configuration_error", "Veritabanı ayarları veya kontrolü tamamlanamadı. Yerel kurulumu kontrol edin.", DateTimeOffset.UtcNow, previous.LastSuccessAtUtc);
            if (previous.State != next.State) logger.LogError("Database check failed: {ExceptionType}", ex.GetType().Name);
        }
        Volatile.Write(ref _status, next);
        if (previous.State != next.State) logger.LogInformation("Database state changed to {State}", next.State);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CheckOnceAsync(stoppingToken);
                await Task.Delay(TimeSpan.FromSeconds(Math.Clamp(options.CheckIntervalSeconds, 2, 300)), stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
        }
    }
}
