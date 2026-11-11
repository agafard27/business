using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Windows.Forms;
using DukkanRevize.Data;

namespace DukkanRevize.Diagnostics
{
    internal static class DeviceCheck
    {
        public static string Summary()
        {
            var text = new StringBuilder();
            text.AppendLine("DÜKKAN REVİZE · CİHAZ DENETİMİ");
            text.AppendLine("Tarih: " + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"));
            text.AppendLine("Windows sürümü: " + Environment.OSVersion.Version);
            text.AppendLine("Uygulama mimarisi: " + (IntPtr.Size == 4 ? "32 bit (x86)" : "64 bit"));
            text.AppendLine("CLR sürümü: " + Environment.Version);
            text.AppendLine("Ekran: " + Screen.PrimaryScreen.Bounds.Width + " × " + Screen.PrimaryScreen.Bounds.Height);
            text.AppendLine("Kullanılabilir ekran: " + Screen.PrimaryScreen.WorkingArea.Width + " × " + Screen.PrimaryScreen.WorkingArea.Height);
            using (var process = Process.GetCurrentProcess())
                text.AppendLine("Bu uygulamanın belleği: " + (process.WorkingSet64 / (1024 * 1024)) + " MB (anlık)");
            text.AppendLine();
            text.AppendLine("Hedef: Windows 7 SP1 · 32 bit · 2 GB RAM · 1024 × 768");
            text.AppendLine("Satış modülleri aktarım aşamasındadır.");
            return text.ToString();
        }

        public static string RunDatabaseProbe()
        {
            // Every run owns an empty temporary directory; no live schema is opened.
            string folder = Path.Combine(Path.GetTempPath(), "DukkanRevize-Probe-" + Guid.NewGuid().ToString("N"));
            string file = Path.Combine(folder, "cihaz-denemesi.db");
            Directory.CreateDirectory(folder);
            try
            {
                var timer = Stopwatch.StartNew();
                string version = SqliteDatabase.Version;
                using (var database = new SqliteDatabase(file))
                {
                    database.Execute("CREATE TABLE probe (id INTEGER PRIMARY KEY, text_value TEXT NOT NULL, amount INTEGER NOT NULL)");
                    database.Execute("BEGIN IMMEDIATE");
                    database.Execute("INSERT INTO probe (text_value, amount) VALUES (?, ?)", "İçecek · çığöşü", 12550L);
                    database.Execute("COMMIT");
                    database.Execute("BEGIN IMMEDIATE");
                    database.Execute("INSERT INTO probe (text_value, amount) VALUES (?, ?)", "Geri alınacak", 1L);
                    database.Execute("ROLLBACK");
                }
                using (var reopened = new SqliteDatabase(file))
                {
                    if (reopened.ScalarText("SELECT COUNT(*) FROM probe") != "1" ||
                        reopened.ScalarText("SELECT text_value FROM probe") != "İçecek · çığöşü" ||
                        reopened.ScalarText("SELECT amount FROM probe") != "12550" ||
                        reopened.ScalarText("PRAGMA integrity_check") != "ok")
                        throw new InvalidOperationException("SQLITE_PROBE_FAILED");
                }
                timer.Stop();
                return "BAŞARILI · SQLite " + version + " (x86)\r\nDosyaya yazma, Türkçe metin, tam sayı para, COMMIT, ROLLBACK ve yeniden açma doğrulandı.\r\nSüre: " + timer.ElapsedMilliseconds + " ms\r\nDeneme veritabanı temizlendi; işletme verisi oluşturulmadı.";
            }
            finally
            {
                // Only this generated probe directory can ever be removed here.
                string resolved = Path.GetFullPath(folder);
                string allowed = Path.GetFullPath(Path.GetTempPath()).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar + "DukkanRevize-Probe-";
                if (resolved.StartsWith(allowed, StringComparison.OrdinalIgnoreCase)) Directory.Delete(resolved, true);
            }
        }
    }
}

