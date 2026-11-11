using Microsoft.AspNetCore.Diagnostics;
using NarCicegi.Api.Database;

try
{
// Resolve defaults from the executable, even when started from another folder.
var rootArgument = Array.IndexOf(args, "--contentRoot");
var contentRoot = rootArgument >= 0 && rootArgument + 1 < args.Length ? Path.GetFullPath(args[rootArgument + 1]) : AppContext.BaseDirectory;
var builder = WebApplication.CreateBuilder(new WebApplicationOptions { Args = args, ContentRootPath = contentRoot });
// Windows EventLog writes require privileges and must not take down a request or worker.
builder.Logging.ClearProviders();
builder.Logging.AddJsonConsole();
var localConfig = Environment.GetEnvironmentVariable("NAR_LOCAL_CONFIG");
if (!string.IsNullOrWhiteSpace(localConfig)) builder.Configuration.AddJsonFile(localConfig, optional: args.Contains("--setup-local"), reloadOnChange: false);
// Environment variables always override the local encrypted configuration.
builder.Configuration.AddEnvironmentVariables();
var options = builder.Configuration.GetSection("Database").Get<DatabaseOptions>() ?? new();

if (args.Contains("--setup-local"))
{
    try
    {
        if (string.IsNullOrWhiteSpace(localConfig)) throw new InvalidOperationException("Kurulum.ps1 ile başlatın.");
        using var timeout = new CancellationTokenSource(TimeSpan.FromMinutes(10));
        await LocalSetup.RunAsync(localConfig, options, timeout.Token);
    }
    catch (Exception ex)
    {
        // Setup explanations are ours; MySQL exceptions may contain server/user details.
        Console.Error.WriteLine(ex is InvalidOperationException ? ex.Message : ex is MySqlConnector.MySqlException mysql
            ? $"Kurulum tamamlanamadı (MySQL kodu: {mysql.Number}). Bağlantı ve yönetici erişimini kontrol edin."
            : $"Kurulum tamamlanamadı ({ex.GetType().Name}). MySQL erişimini kontrol edin.");
        Environment.ExitCode = 1;
    }
    return;
}

if (args.Contains("--migrate"))
{
    try
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(60));
        await Schema.MigrateAsync(options, timeout.Token);
        Console.WriteLine($"Şema hazır. Sürüm: {Schema.Version}");
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"Şema kurulamadı ({ex.GetType().Name}). Bağlantı, yetki ve MySQL 8 ayarlarını kontrol edin.");
        Environment.ExitCode = 1;
    }
    return;
}

builder.Services.AddSingleton(options);
builder.Services.AddSingleton<IDatabaseProbe, MySqlProbe>();
builder.Services.AddSingleton<DatabaseMonitor>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<DatabaseMonitor>());
builder.Services.AddProblemDetails();
var app = builder.Build();

app.UseExceptionHandler(error => error.Run(async context =>
{
    var exception = context.Features.Get<IExceptionHandlerFeature>()?.Error;
    app.Logger.LogError("Request failed. Trace {TraceId}; type {ExceptionType}", context.TraceIdentifier, exception?.GetType().Name);
    await Results.Problem(statusCode: 500, title: "İşlem tamamlanamadı.",
        extensions: new Dictionary<string, object?> { ["traceId"] = context.TraceIdentifier }).ExecuteAsync(context);
}));
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
    context.Response.Headers["Referrer-Policy"] = "no-referrer";
    context.Response.Headers.CacheControl = "no-store";
    await next(context);
});
app.UseDefaultFiles();
app.UseStaticFiles();
app.MapGet("/health/live", () => Results.Ok(new { status = "alive" }));
app.MapGet("/health/ready", (DatabaseMonitor monitor) =>
    monitor.Status.Ready ? Results.Ok(new { status = "ready" }) : Results.Json(new { status = "not_ready" }, statusCode: 503));
app.MapGet("/api/system/status", (DatabaseMonitor monitor) => Results.Ok(new
{
    application = "Nar Çiçeği", stage = "foundation", checkedAtUtc = DateTimeOffset.UtcNow,
    database = monitor.Status,
    businessOperationsEnabled = false
}));
await app.RunAsync();
}
catch (Exception ex)
{
    Console.Error.WriteLine($"Uygulama başlatılamadı veya durduruldu ({ex.GetType().Name}). Başlangıç yolu, port ve yerel ayarları kontrol edin.");
    Environment.ExitCode = 1;
}

public partial class Program;
