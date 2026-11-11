using MySqlConnector;
using System.Security.Cryptography;
using System.Text;

namespace NarCicegi.Api.Database;

public sealed class DatabaseOptions
{
    public string Host { get; set; } = "127.0.0.1";
    public uint Port { get; set; } = 3306;
    public string Name { get; set; } = "nar_cicegi";
    public string User { get; set; } = "nar_cicegi_app";
    public string Password { get; set; } = "";
    public string ProtectedPassword { get; set; } = "";
    public string SslMode { get; set; } = "Preferred";
    public int TimeoutSeconds { get; set; } = 5;
    public int CheckIntervalSeconds { get; set; } = 10;
    public uint MaximumPoolSize { get; set; } = 20;

    public string ConnectionString()
    {
        if (string.IsNullOrWhiteSpace(Host) || string.IsNullOrWhiteSpace(Name) ||
            string.IsNullOrWhiteSpace(User) || Port is 0 or > 65535 ||
            TimeoutSeconds is < 1 or > 30 || CheckIntervalSeconds is < 2 or > 300 ||
            MaximumPoolSize is < 1 or > 100 || !Enum.TryParse<MySqlSslMode>(SslMode, true, out var ssl))
            throw new InvalidOperationException("Veritabanı ayarları geçersiz.");

        var password = Password;
        if (string.IsNullOrEmpty(password) && !string.IsNullOrEmpty(ProtectedPassword))
        {
            if (!OperatingSystem.IsWindows())
                throw new InvalidOperationException("Korumalı parola Windows kullanıcısına aittir.");
            password = Encoding.UTF8.GetString(ProtectedData.Unprotect(
                Convert.FromBase64String(ProtectedPassword), null, DataProtectionScope.CurrentUser));
        }

        return new MySqlConnectionStringBuilder
        {
            Server = Host, Port = Port, Database = Name, UserID = User, Password = password,
            SslMode = ssl, Pooling = true, MinimumPoolSize = 0, MaximumPoolSize = MaximumPoolSize,
            ConnectionTimeout = (uint)TimeoutSeconds, DefaultCommandTimeout = (uint)TimeoutSeconds,
            CancellationTimeout = 1, ConnectionReset = true, PersistSecurityInfo = false,
            AllowUserVariables = false, AllowLoadLocalInfile = false
        }.ConnectionString;
    }
}
