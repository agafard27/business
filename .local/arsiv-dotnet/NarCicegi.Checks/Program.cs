using Microsoft.Extensions.Logging.Abstractions;
using NarCicegi.Api.Database;

try
{
var probe = new SwitchProbe();
var monitor = new DatabaseMonitor(probe, new(), NullLogger<DatabaseMonitor>.Instance);
Assert(!monitor.Status.Ready, "İlk durumda hazır değil");
await monitor.CheckOnceAsync(default);
Assert(monitor.Status.Ready, "Uygun şema hazır");
var lastSuccess = monitor.Status.LastSuccessAtUtc;
probe.Failure = new InvalidOperationException("password=DO_NOT_EXPOSE");
await monitor.CheckOnceAsync(default);
Assert(!monitor.Status.Ready && monitor.Status.LastSuccessAtUtc == lastSuccess, "Kesintide hazır değil; son başarı korunuyor");
Assert(!monitor.Status.Message.Contains("DO_NOT_EXPOSE"), "Parola HTTP durumuna sızmıyor");
probe.Failure = null;
await monitor.CheckOnceAsync(default);
Assert(monitor.Status.Ready, "Bağlantı düzelince toparlanıyor");
probe.Version = Schema.Version + 1;
await monitor.CheckOnceAsync(default);
Assert(!monitor.Status.Ready, "Yeni şema eski uygulamayla kabul edilmiyor");
probe.Version = Schema.Version;
probe.TablesPresent = false;
await monitor.CheckOnceAsync(default);
Assert(!monitor.Status.Ready, "Eksik tablolar hazır sayılmıyor");
probe.Failure = new OperationCanceledException();
using var cancelled = new CancellationTokenSource();
cancelled.Cancel();
try { await monitor.CheckOnceAsync(cancelled.Token); throw new Exception("İptal yutuldu"); }
catch (OperationCanceledException) { Console.WriteLine("OK: Durdurma iptali korunuyor"); }
if (args.Contains("--integration")) await Integration.RunAsync();
Console.WriteLine("Tüm kontroller geçti.");
}
catch (Exception ex)
{
    Console.Error.WriteLine($"Kontrol tamamlanamadı ({ex.GetType().Name}).");
    Environment.ExitCode = 1;
}

static void Assert(bool condition, string name)
{
    if (!condition) throw new Exception(name);
    Console.WriteLine("OK: " + name);
}

sealed class SwitchProbe : IDatabaseProbe
{
    public Exception? Failure { get; set; }
    public int Version { get; set; } = Schema.Version;
    public bool TablesPresent { get; set; } = true;
    public Task<(int Version, bool TablesPresent)> CheckAsync(CancellationToken ct) => Failure is null
        ? Task.FromResult((Version, TablesPresent)) : Task.FromException<(int, bool)>(Failure);
}
