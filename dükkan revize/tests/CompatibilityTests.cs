using System;
using System.Drawing;
using System.IO;
using System.Windows.Forms;
using DukkanRevize.Data;
using DukkanRevize.Diagnostics;
using DukkanRevize.UI;

namespace DukkanRevize.Tests
{
    internal static class TestRunner
    {
        [STAThread]
        public static int Main(string[] args)
        {
            string output = args.Length == 1 ? Path.GetFullPath(args[0]) : Path.Combine(Path.GetTempPath(), "DukkanRevize-TestResults");
            Directory.CreateDirectory(output);
            int failed = 0;
            Action<string, Action> run = (name, action) =>
            {
                try { action(); Console.WriteLine("PASS " + name); }
                catch (Exception error) { failed++; Console.WriteLine("FAIL " + name + ": " + error.GetType().Name + " / " + error.Message); }
            };
            run("x86 process", () => Assert(IntPtr.Size == 4, "Expected 32-bit process"));
            run("persistent transaction and Unicode probe", () => Assert(DeviceCheck.RunDatabaseProbe().StartsWith("BAŞARILI"), "Probe failed"));
            run("foreign keys, binding and transaction rollback", () =>
            {
                using (var db = new SqliteDatabase(":memory:"))
                {
                    db.Execute("CREATE TABLE parent(id INTEGER PRIMARY KEY)");
                    db.Execute("CREATE TABLE child(parent_id INTEGER REFERENCES parent(id), note TEXT)");
                    bool rejected = false;
                    try { db.Execute("INSERT INTO child(parent_id) VALUES (?)", 999L); }
                    catch (InvalidOperationException) { rejected = true; }
                    Assert(rejected, "Foreign key must reject missing parent");
                    db.Execute("INSERT INTO parent(id) VALUES (?)", 1L);
                    string input = "İşlem'); DROP TABLE parent; --";
                    db.Execute("INSERT INTO child(parent_id,note) VALUES (?,?)", 1L, input);
                    Assert(db.ScalarText("SELECT note FROM child") == input, "Bound text changed SQL behavior");
                    db.Execute("BEGIN IMMEDIATE");
                    db.Execute("INSERT INTO parent(id) VALUES (?)", 2L);
                    db.Execute("ROLLBACK");
                    Assert(db.ScalarText("SELECT COUNT(*) FROM parent") == "1", "Rollback did not preserve original row");
                    db.Execute("CREATE TABLE amounts(value INTEGER NOT NULL)");
                    db.Execute("INSERT INTO amounts VALUES (?)", long.MaxValue);
                    Assert(db.ScalarText("SELECT value FROM amounts") == long.MaxValue.ToString(System.Globalization.CultureInfo.InvariantCulture), "Integer precision lost");
                }
            });
            run("write contention fails without retry or extra records", () =>
            {
                string folder = Path.Combine(Path.GetTempPath(), "DukkanRevize-LockTest-" + Guid.NewGuid().ToString("N"));
                Directory.CreateDirectory(folder);
                try
                {
                    using (var first = new SqliteDatabase(Path.Combine(folder, "lock.db")))
                    using (var second = new SqliteDatabase(Path.Combine(folder, "lock.db")))
                    {
                        first.Execute("CREATE TABLE entries(id INTEGER PRIMARY KEY)");
                        first.Execute("BEGIN IMMEDIATE");
                        first.Execute("INSERT INTO entries VALUES (?)", 1L);
                        bool busy = false;
                        try { second.Execute("INSERT INTO entries VALUES (?)", 2L); }
                        catch (InvalidOperationException error) { busy = error.Message == "SQLITE_ERROR_5"; }
                        Assert(busy, "Second writer must fail with SQLITE_BUSY");
                        first.Execute("COMMIT");
                        Assert(second.ScalarText("SELECT COUNT(*) FROM entries") == "1", "Busy write must not have been retried");
                    }
                }
                finally
                {
                    string allowed = Path.GetFullPath(Path.GetTempPath()).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar + "DukkanRevize-LockTest-";
                    if (Path.GetFullPath(folder).StartsWith(allowed, StringComparison.OrdinalIgnoreCase)) Directory.Delete(folder, true);
                }
            });
            run("1024x768 layout and navigation", () =>
            {
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                using (var form = new MainForm())
                {
                    form.WindowState = FormWindowState.Normal;
                    form.Size = new Size(1024, 728);
                    form.ShowInTaskbar = false;
                    form.StartPosition = FormStartPosition.Manual;
                    form.Location = new Point(-20000, -20000);
                    form.Show();
                    Application.DoEvents();
                    form.ShowHome();
                    form.PerformLayout();
                    Application.DoEvents();
                    Assert(form.CurrentPage == "home", "Home missing");
                    using (var bitmap = new Bitmap(form.Width, form.Height))
                    {
                        form.DrawToBitmap(bitmap, new Rectangle(Point.Empty, form.Size));
                        Assert(bitmap.GetPixel(300, 50).ToArgb() == Color.FromArgb(30, 48, 62).ToArgb(), "Header was not rendered");
                        bitmap.Save(Path.Combine(output, "home-1024.png"));
                    }
                    form.ShowDiagnostics();
                    form.PerformLayout();
                    Application.DoEvents();
                    Assert(form.CurrentPage == "diagnostics", "Diagnostics missing");
                    using (var bitmap = new Bitmap(form.Width, form.Height))
                    {
                        form.DrawToBitmap(bitmap, new Rectangle(Point.Empty, form.Size));
                        bitmap.Save(Path.Combine(output, "diagnostics-1024.png"));
                    }
                    form.ShowModules();
                    Assert(form.CurrentPage == "modules", "Module list missing");
                }
            });
            Console.WriteLine(failed == 0 ? "All 5 checks passed." : failed + " checks failed.");
            return failed == 0 ? 0 : 1;
        }

        private static void Assert(bool condition, string message)
        {
            if (!condition) throw new InvalidOperationException(message);
        }
    }
}

