using System;
using System.Drawing;
using System.IO;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;
using DukkanRevize.Core;
using DukkanRevize.Diagnostics;

namespace DukkanRevize.UI
{
    internal sealed class MainForm : Form
    {
        private readonly Panel content = new Panel();
        private readonly Label status = new Label();
        private readonly Color ink = Color.FromArgb(30, 48, 62);
        private string lastReport = "";
        internal string CurrentPage { get; private set; }

        public MainForm()
        {
            Text = "Dükkan Revize · Cihaz uyumluluk sürümü";
            Font = new Font("Segoe UI", 11);
            AutoScaleMode = AutoScaleMode.Dpi;
            AutoScaleDimensions = new SizeF(96, 96);
            MinimumSize = new Size(800, 580);
            ClientSize = new Size(1000, 690);
            StartPosition = FormStartPosition.CenterScreen;
            WindowState = FormWindowState.Maximized;
            BackColor = Color.FromArgb(243, 246, 247);

            var header = new Panel { Dock = DockStyle.Top, Height = 76, BackColor = ink, Padding = new Padding(20, 12, 20, 8) };
            header.Controls.Add(new Label { Text = "DÜKKAN REVİZE", Dock = DockStyle.Top, Height = 30, Font = new Font("Segoe UI", 17, FontStyle.Bold), ForeColor = Color.White });
            header.Controls.Add(new Label { Text = "Sabit donanım için ayrı proje · İlk cihaz denemesi", Dock = DockStyle.Bottom, Height = 22, ForeColor = Color.FromArgb(203, 218, 228) });

            var navigation = new FlowLayoutPanel { Dock = DockStyle.Left, Width = 206, FlowDirection = FlowDirection.TopDown, WrapContents = false, BackColor = Color.White, Padding = new Padding(10, 18, 10, 10) };
            navigation.Controls.Add(NavButton("Başlangıç", ShowHome));
            navigation.Controls.Add(NavButton("Cihaz denetimi", ShowDiagnostics));
            navigation.Controls.Add(NavButton("Aktarım kapsamı", ShowModules));
            navigation.Controls.Add(new Label { Text = "Windows 7 SP1\r\n32 bit · 2 GB RAM\r\n1024 × 768", Width = 180, Height = 85, Margin = new Padding(4, 24, 0, 0), ForeColor = Color.DimGray });

            status.Dock = DockStyle.Bottom;
            status.Height = 36;
            status.Padding = new Padding(16, 8, 0, 0);
            status.BackColor = Color.FromArgb(226, 233, 236);
            status.Text = "İlk sürüm · Henüz satış veya canlı veri aktarımı yapılmaz.";
            status.Font = new Font("Segoe UI", 9);
            content.Dock = DockStyle.Fill;
            content.Padding = new Padding(22, 18, 22, 12);
            content.AutoScroll = true;
            Controls.Add(content);
            Controls.Add(navigation);
            Controls.Add(status);
            Controls.Add(header);
            ShowHome();
        }

        private Button NavButton(string caption, Action action)
        {
            var button = new Button { Text = caption, Width = 180, Height = 52, FlatStyle = FlatStyle.Flat, BackColor = Color.White, ForeColor = ink, TextAlign = ContentAlignment.MiddleLeft, Padding = new Padding(10, 0, 0, 0), Margin = new Padding(0, 0, 0, 9) };
            button.FlatAppearance.BorderColor = Color.FromArgb(218, 225, 229);
            button.Click += delegate { action(); };
            return button;
        }

        private FlowLayoutPanel BeginPage(string title, string description)
        {
            while (content.Controls.Count > 0) content.Controls[0].Dispose();
            var page = new FlowLayoutPanel { Dock = DockStyle.Top, AutoSize = true, AutoSizeMode = AutoSizeMode.GrowAndShrink, FlowDirection = FlowDirection.TopDown, WrapContents = false, Padding = new Padding(0, 0, 0, 8) };
            page.Width = Math.Max(400, content.ClientSize.Width - 44);
            content.Controls.Add(page);
            AddText(page, title, 19, true);
            AddText(page, description, 11, false);
            return page;
        }

        private static Label AddText(FlowLayoutPanel page, string text, float size, bool bold)
        {
            var label = new Label { Text = text, AutoSize = true, MaximumSize = new Size(Math.Max(340, page.Width - 20), 0), Font = new Font("Segoe UI", size, bold ? FontStyle.Bold : FontStyle.Regular), ForeColor = Color.FromArgb(30, 48, 62), Margin = new Padding(0, 0, 0, 15) };
            page.Controls.Add(label);
            page.SizeChanged += delegate { label.MaximumSize = new Size(Math.Max(340, page.ClientSize.Width - 20), 0); };
            return label;
        }

        internal void ShowHome()
        {
            CurrentPage = "home";
            var page = BeginPage("Eldeki cihaz için yeni başlangıç", "Mevcut Nar Çiçeği özellikleri, bu cihazın sınırlarına göre ayrı projeye aktarılıyor.");
            AddText(page, "1  ·  Önce cihazda çalışmayı doğrulayalım", 13, true);
            AddText(page, "Bu sürüm ekranı, dokunarak kullanımı, yerel veritabanını ve yazıcıyı denemek içindir. Satış modülleri henüz aktarılmadı.", 11, false);
            var actions = new FlowLayoutPanel { AutoSize = true, WrapContents = true, Width = 650, Height = 64, Margin = new Padding(0, 0, 0, 18) };
            var check = NavButton("Cihazı denetle", ShowDiagnostics);
            check.BackColor = Color.FromArgb(221, 237, 231);
            actions.Controls.Add(check);
            actions.Controls.Add(NavButton("Özellikleri gör", ShowModules));
            page.Controls.Add(actions);
            AddText(page, "2  ·  Günlük iş akışları korunacak", 13, true);
            AddText(page, "Masa ve sipariş → ödeme → mutfak ve stok → alış, cari ve kasa → rapor ve yedek. Tüm özelliklerin listesi Aktarım kapsamı ekranında.", 11, false);
            AddText(page, "Yerel masaüstü uygulaması", 13, true);
            AddText(page, "Bu cihaz denemesi tarayıcı, internet, MySQL servisi veya telefon sertifikası gerektirmez. Çalışmak için .NET Framework 4.8 gerekir.", 11, false);
        }

        internal void ShowDiagnostics()
        {
            CurrentPage = "diagnostics";
            var page = BeginPage("Cihaz denetimi", "Aşağıdaki denemeleri IBM cihazında çalıştırıp raporu kaydedin.");
            var report = new TextBox { Multiline = true, ReadOnly = true, ScrollBars = ScrollBars.Vertical, Width = Math.Max(400, page.Width - 20), Height = 215, Text = DeviceCheck.Summary(), Font = new Font("Segoe UI", 10), BackColor = Color.White };
            page.Controls.Add(report);
            page.SizeChanged += delegate { report.Width = Math.Max(400, page.ClientSize.Width - 20); };
            var result = AddText(page, "Veritabanı denemesi henüz çalıştırılmadı.", 10, false);
            result.Margin = new Padding(0, 14, 0, 12);
            var buttons = new FlowLayoutPanel { AutoSize = true, WrapContents = true, Width = 650, Margin = new Padding(0) };
            var probe = NavButton("Veritabanını dene", delegate { });
            probe.Width = 190;
            probe.Click += async delegate
            {
                probe.Enabled = false;
                result.Text = "Deneme sürüyor…";
                try
                {
                    string outcome = await Task.Run(() => DeviceCheck.RunDatabaseProbe());
                    if (!result.IsDisposed) result.Text = outcome;
                    lastReport = report.IsDisposed ? DeviceCheck.Summary() + "\r\n" + outcome : report.Text + "\r\n" + outcome;
                }
                catch (Exception error)
                {
                    string code = error is DllNotFoundException ? "SQLITE_DLL_MISSING" : error is BadImageFormatException ? "SQLITE_ARCHITECTURE_MISMATCH" : "DATABASE_PROBE_FAILED";
                    if (!result.IsDisposed) result.Text = "Deneme tamamlanamadı: " + code + ". Paket dosyalarını kontrol edin.";
                    lastReport = DeviceCheck.Summary() + "\r\n" + code;
                }
                finally { if (!probe.IsDisposed) probe.Enabled = true; }
            };
            buttons.Controls.Add(probe);
            int taps = 0;
            Button touch = null;
            touch = NavButton("Dokunma: 0", delegate { taps++; touch.Text = "Dokunma: " + taps; });
            touch.Width = 155;
            buttons.Controls.Add(touch);
            var print = NavButton("Yazıcıyı dene", delegate { PrintProbe.Show(this); });
            print.Width = 155;
            buttons.Controls.Add(print);
            var save = NavButton("Raporu kaydet", delegate
            {
                using (var dialog = new SaveFileDialog { Filter = "Metin raporu (*.txt)|*.txt", FileName = "DukkanRevize-CihazRaporu.txt", OverwritePrompt = true })
                    if (dialog.ShowDialog(this) == DialogResult.OK)
                        File.WriteAllText(dialog.FileName, lastReport.Length == 0 ? DeviceCheck.Summary() + "\r\nVeritabanı denemesi yapılmadı." : lastReport, new UTF8Encoding(true));
            });
            save.Width = 180;
            buttons.Controls.Add(save);
            page.Controls.Add(buttons);
            AddText(page, "Yazdırma denemesi Windows yazıcı seçimini açar. Çıktıyı fiziksel olarak kontrol edin; yazıcıya gönderilmesi baskının başarılı olduğunu kanıtlamaz.", 10, false);
        }

        internal void ShowModules()
        {
            CurrentPage = "modules";
            var page = BeginPage("Mevcut özelliklerin aktarımı", "Aşağıdaki alanlar yeni projenin kapsamındadır. Bu sürümde iş ekranları henüz kullanıma açılmadı.");
            foreach (var module in ModuleCatalog.All)
            {
                AddText(page, module.Name + "  ·  Aktarılacak", 12, true).Margin = new Padding(0, 0, 0, 4);
                AddText(page, module.Scope, 10, false);
            }
        }
    }
}

