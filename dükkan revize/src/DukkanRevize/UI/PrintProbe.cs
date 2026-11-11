using System.Drawing;
using System.Drawing.Printing;
using System.Windows.Forms;

namespace DukkanRevize.UI
{
    internal static class PrintProbe
    {
        public static void Show(IWin32Window owner)
        {
            using (var document = new PrintDocument())
            using (var dialog = new PrintDialog())
            {
                document.DocumentName = "Dükkan Revize · yazıcı denemesi";
                document.PrintPage += delegate(object sender, PrintPageEventArgs e)
                {
                    using (var font = new Font("Arial", 11))
                        e.Graphics.DrawString("DÜKKAN REVİZE\r\nYAZICI DENEMESİ\r\nİ ı Ş ş Ğ ğ Ü ü Ö ö Ç ç\r\n0123456789\r\nBu çıktı satış fişi değildir.", font, Brushes.Black, e.MarginBounds);
                    e.HasMorePages = false;
                };
                dialog.Document = document;
                dialog.UseEXDialog = true;
                if (dialog.ShowDialog(owner) == DialogResult.OK) document.Print();
            }
        }
    }
}

