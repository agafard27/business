using System;
using System.Reflection;
using System.Runtime.Versioning;
using System.Windows.Forms;

[assembly: AssemblyTitle("Dükkan Revize")]
[assembly: AssemblyVersion("0.1.0.0")]
[assembly: TargetFramework(".NETFramework,Version=v4.8")]

namespace DukkanRevize
{
    internal static class Program
    {
        [STAThread]
        private static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
            Application.ThreadException += delegate
            {
                MessageBox.Show("İşlem tamamlanamadı. Uygulamayı yeniden açıp cihaz denetimini çalıştırın.", "Dükkan Revize", MessageBoxButtons.OK, MessageBoxIcon.Error);
            };
            Application.Run(new UI.MainForm());
        }
    }
}

