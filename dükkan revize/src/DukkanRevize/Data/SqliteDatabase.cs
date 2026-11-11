using System;
using System.Runtime.InteropServices;
using System.Text;

namespace DukkanRevize.Data
{
    // Small UTF-8 adapter. No ADO provider, background service or shared DB file.
    internal sealed class SqliteDatabase : IDisposable
    {
        private IntPtr database;
        private const int Ok = 0, Row = 100, Done = 101;
        private static readonly IntPtr Transient = new IntPtr(-1);
        private static byte[] Utf8(string value) { return Encoding.UTF8.GetBytes(value + "\0"); }
        public static string Version { get { return Marshal.PtrToStringAnsi(sqlite3_libversion()); } }

        public SqliteDatabase(string file)
        {
            int code = sqlite3_open_v2(Utf8(file), out database, 0x00000002 | 0x00000004 | 0x00010000, IntPtr.Zero);
            if (code != Ok)
            {
                Dispose();
                throw new InvalidOperationException("SQLITE_OPEN_FAILED_" + code);
            }
            try
            {
                Check(sqlite3_busy_timeout(database, 1500));
                Execute("PRAGMA foreign_keys = ON");
                Execute("PRAGMA synchronous = FULL");
            }
            catch { Dispose(); throw; }
        }

        public void Execute(string sql, params object[] parameters)
        {
            IntPtr statement = Prepare(sql, parameters);
            try
            {
                int code;
                do { code = sqlite3_step(statement); } while (code == Row);
                if (code != Done) Check(code);
            }
            finally { sqlite3_finalize(statement); }
        }

        public string ScalarText(string sql, params object[] parameters)
        {
            IntPtr statement = Prepare(sql, parameters);
            try
            {
                int code = sqlite3_step(statement);
                if (code == Done) return null;
                if (code != Row) Check(code);
                IntPtr pointer = sqlite3_column_text(statement, 0);
                if (pointer == IntPtr.Zero) return null;
                int length = sqlite3_column_bytes(statement, 0);
                byte[] bytes = new byte[length];
                Marshal.Copy(pointer, bytes, 0, length);
                return Encoding.UTF8.GetString(bytes);
            }
            finally { sqlite3_finalize(statement); }
        }

        private IntPtr Prepare(string sql, object[] parameters)
        {
            if (database == IntPtr.Zero) throw new ObjectDisposedException("SqliteDatabase");
            byte[] bytes = Utf8(sql);
            IntPtr statement;
            Check(sqlite3_prepare_v2(database, bytes, bytes.Length, out statement, IntPtr.Zero));
            try
            {
                if (sqlite3_bind_parameter_count(statement) != parameters.Length) throw new ArgumentException("SQLITE_PARAMETER_COUNT");
                for (int i = 0; i < parameters.Length; i++)
                {
                    object value = parameters[i];
                    if (value == null) Check(sqlite3_bind_null(statement, i + 1));
                    else if (value is long || value is int) Check(sqlite3_bind_int64(statement, i + 1, Convert.ToInt64(value)));
                    else if (value is string)
                    {
                        byte[] text = Utf8((string)value);
                        Check(sqlite3_bind_text(statement, i + 1, text, text.Length - 1, Transient));
                    }
                    else throw new ArgumentException("SQLITE_UNSUPPORTED_PARAMETER_TYPE");
                }
                return statement;
            }
            catch { sqlite3_finalize(statement); throw; }
        }

        private static void Check(int code)
        {
            if (code != Ok) throw new InvalidOperationException("SQLITE_ERROR_" + code);
        }
        public void Dispose()
        {
            if (database != IntPtr.Zero)
            {
                sqlite3_close_v2(database);
                database = IntPtr.Zero;
            }
        }

        [DllImport("sqlite3.dll", CallingConvention = CallingConvention.Cdecl)] private static extern IntPtr sqlite3_libversion();
        [DllImport("sqlite3.dll", CallingConvention = CallingConvention.Cdecl)] private static extern int sqlite3_open_v2(byte[] file, out IntPtr db, int flags, IntPtr vfs);
        [DllImport("sqlite3.dll", CallingConvention = CallingConvention.Cdecl)] private static extern int sqlite3_close_v2(IntPtr db);
        [DllImport("sqlite3.dll", CallingConvention = CallingConvention.Cdecl)] private static extern int sqlite3_busy_timeout(IntPtr db, int milliseconds);
        [DllImport("sqlite3.dll", CallingConvention = CallingConvention.Cdecl)] private static extern int sqlite3_prepare_v2(IntPtr db, byte[] sql, int bytes, out IntPtr statement, IntPtr tail);
        [DllImport("sqlite3.dll", CallingConvention = CallingConvention.Cdecl)] private static extern int sqlite3_step(IntPtr statement);
        [DllImport("sqlite3.dll", CallingConvention = CallingConvention.Cdecl)] private static extern int sqlite3_finalize(IntPtr statement);
        [DllImport("sqlite3.dll", CallingConvention = CallingConvention.Cdecl)] private static extern int sqlite3_bind_parameter_count(IntPtr statement);
        [DllImport("sqlite3.dll", CallingConvention = CallingConvention.Cdecl)] private static extern int sqlite3_bind_null(IntPtr statement, int index);
        [DllImport("sqlite3.dll", CallingConvention = CallingConvention.Cdecl)] private static extern int sqlite3_bind_int64(IntPtr statement, int index, long value);
        [DllImport("sqlite3.dll", CallingConvention = CallingConvention.Cdecl)] private static extern int sqlite3_bind_text(IntPtr statement, int index, byte[] value, int length, IntPtr destructor);
        [DllImport("sqlite3.dll", CallingConvention = CallingConvention.Cdecl)] private static extern IntPtr sqlite3_column_text(IntPtr statement, int column);
        [DllImport("sqlite3.dll", CallingConvention = CallingConvention.Cdecl)] private static extern int sqlite3_column_bytes(IntPtr statement, int column);
    }
}

