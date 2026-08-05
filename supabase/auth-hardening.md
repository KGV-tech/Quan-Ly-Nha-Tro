# Hạn chế người dùng đăng nhập

1. Trong Supabase Dashboard, mở **Authentication → Providers → Email**.
2. Tắt **Allow new users to sign up** (hoặc **Enable sign ups**).
3. Vào **Authentication → Users → Add user** để tạo từng tài khoản được phép sử dụng ứng dụng.
4. Đặt URL của ứng dụng Vercel vào **Authentication → URL Configuration → Site URL**.

Ứng dụng chỉ gọi API đăng nhập, không có chức năng tự đăng ký. Chính sách RLS trong `schema.sql` bảo đảm mỗi tài khoản chỉ đọc và ghi dữ liệu của tài khoản đó.
