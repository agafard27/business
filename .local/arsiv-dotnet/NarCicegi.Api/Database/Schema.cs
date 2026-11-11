using MySqlConnector;

namespace NarCicegi.Api.Database;

public static class Schema
{
    public const int Version = 1;

    // MySQL DDL commits implicitly. Each step is restartable and the version is recorded last.
    public static async Task MigrateAsync(DatabaseOptions options, CancellationToken ct)
    {
        await using var connection = new MySqlConnection(options.ConnectionString());
        await connection.OpenAsync(ct);
        var lockName = $"nar_cicegi_schema:{options.Name}";
        await using var acquire = new MySqlCommand("SELECT GET_LOCK(@name, 10)", connection);
        acquire.Parameters.AddWithValue("name", lockName);
        if (Convert.ToInt32(await acquire.ExecuteScalarAsync(ct)) != 1)
            throw new InvalidOperationException("Şema başka bir işlem tarafından güncelleniyor.");
        try
        {
            await ExecuteAsync(connection, """
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version INT NOT NULL PRIMARY KEY,
                    applied_at_utc DATETIME(6) NOT NULL DEFAULT (UTC_TIMESTAMP(6))
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
                """, ct);
            await using var latest = new MySqlCommand("SELECT COALESCE(MAX(version), 0) FROM schema_migrations", connection);
            var current = Convert.ToInt32(await latest.ExecuteScalarAsync(ct));
            if (current > Version) throw new InvalidOperationException("Veritabanı bu uygulamadan daha yeni; eski sürümle devam edilemez.");
            if (current == 0)
            {
                await ExecuteAsync(connection, """
                    CREATE TABLE IF NOT EXISTS application_settings (
                        setting_key VARCHAR(100) NOT NULL PRIMARY KEY,
                        value_json JSON NOT NULL,
                        revision BIGINT NOT NULL DEFAULT 1,
                        updated_at_utc DATETIME(6) NOT NULL DEFAULT (UTC_TIMESTAMP(6))
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
                    """, ct);
                await ExecuteAsync(connection, """
                    INSERT INTO application_settings (setting_key, value_json)
                    VALUES ('business', JSON_OBJECT('name', 'Nar Çiçeği', 'timeZone', 'Europe/Istanbul'))
                    ON DUPLICATE KEY UPDATE setting_key = setting_key
                    """, ct);
                await ExecuteAsync(connection, "INSERT INTO schema_migrations (version) VALUES (1)", ct);
            }
        }
        finally
        {
            // Dispose also releases the lock if the release command fails.
            await using var release = new MySqlCommand("SELECT RELEASE_LOCK(@name)", connection);
            release.Parameters.AddWithValue("name", lockName);
            await release.ExecuteScalarAsync(CancellationToken.None);
        }
    }

    private static async Task ExecuteAsync(MySqlConnection connection, string sql, CancellationToken ct)
    {
        await using var command = new MySqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync(ct);
    }
}
