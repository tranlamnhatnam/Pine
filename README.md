# Pine (Modern Edition)

Tiện ích mở rộng trình duyệt web tự động sắp xếp và tối ưu hóa bộ sưu tập dấu trang (Bookmarks / Favorites) với giao diện Dashboard hiện đại.

---

## 🚀 Tính năng nổi bật

### 1. Tự động sắp xếp (Automatic Sorting)
* **Tự động kích hoạt**: Khi thêm mới, đổi tên hoặc di chuyển dấu trang, tiện ích Pine sẽ tự động sắp xếp theo quy tắc đã thiết lập.
* **Đa dạng tiêu chí sắp xếp**:
  * Theo tên: A – Z hoặc Z – A
  * Theo ngày thêm: Mới nhất trước hoặc Cũ nhất trước
  * Theo URL: Địa chỉ trang web A – Z hoặc Z – A
* **Ưu tiên thư mục (Folders First)**: Tự động gom nhóm toàn bộ các thư mục con lên đầu trước các liên kết trang web.
* **Cấu hình theo từng thư mục gốc & thư mục con**:
  * Thanh dấu trang (Bookmarks Bar / Favorites Bar)
  * Dấu trang khác (Other Bookmarks / Other Favorites)
  * Dấu trang di động (Mobile Bookmarks)
  * Hỗ trợ đệ quy cho toàn bộ thư mục con (Subfolders).

### 2. Giao diện Dashboard hiện đại (Stylebot Style)
* **Bố cục SPA tinh gọn**: Toàn bộ tính năng nằm trong một trang điều khiển trực quan, chuyển đổi tức thì giữa các tab.
* **Hỗ trợ Dark Mode & Light Mode**: Tùy chọn Theo hệ thống, Sáng, hoặc Tối với CSS Variables mượt mà.
* **Giao diện tiếng Việt 100%**: Trải nghiệm thân thiện, câu từ tự nhiên và chuẩn mực.

### 3. Công cụ dọn dẹp & tối ưu (Tools)
* **Thư mục trống (Empty Folders)**: Quét và hỗ trợ xóa nhanh các thư mục rỗng không chứa dấu trang.
* **Dấu trang trùng lặp (Duplicate Bookmarks)**: Phát hiện và xử lý các liên kết có cùng URL chính xác.
* **Dấu trang tương tự (Similar Bookmarks)**: Tìm và dọn dẹp các dấu trang cùng tên miền hoặc đường dẫn tương tự.

### 4. Lịch sử phiên bản (Bookmark History)
* **Gom nhóm theo ngày**: Xem lại chi tiết từng hoạt động (Đã thêm, Đã sửa, Đã xóa, Đã di chuyển) theo mốc thời gian (*Hôm nay, Hôm qua, Thứ Sáu...*).
* **Bộ lọc thông minh**: Lọc nhanh theo loại thay đổi và tìm kiếm dấu trang.

### 5. Đánh giá & Kiểm tra trật tự dấu trang (Sorting & Organization Audit)
* **Đánh giá trật tự tự động**: Chấm điểm độ ngăn nắp và tính toán tỷ lệ tuân thủ quy tắc sắp xếp (Sort Compliance Rate) tức thì theo thời gian thực.
* **Báo cáo chi tiết thư mục lệch**: Nhận diện chính xác thư mục nào chưa đúng quy tắc, số lượng dấu trang đang nằm sai vị trí.
* **Sắp xếp theo từng thư mục**: Cho phép chủ động sắp xếp riêng từng thư mục bị xáo trộn hoặc chạy sắp xếp toàn bộ.
* **Huy hiệu trạng thái nhanh trên Popup**: Hiển thị ngay trạng thái (100% Đã sắp xếp / Cần tối ưu) để người dùng nắm bắt tức thì khi mở menu extension.

### 6. Tính năng mới cải tiến
* **Nút "Sắp xếp ngay" (Manual Sort Trigger)**: Chủ động chạy sắp xếp lại toàn bộ dấu trang bất cứ lúc nào với nút bấm trực tiếp.
* **Tìm kiếm trực tiếp (Live Search)**: Tìm kiếm tức thì trong danh sách thư mục và lịch sử.
* **Sao lưu & Khôi phục (Backup & Restore)**: Xuất toàn bộ cấu hình ra file `.json` và nhập lại dễ dàng trên máy tính khác.

---

## 📦 Hướng dẫn cài đặt (Load Unpacked)

### Dành cho Google Chrome / Cốc Cốc / Brave:
1. Mở trình duyệt và truy cập: `chrome://extensions`
2. Bật công tắc **Developer mode (Chế độ dành cho nhà phát triển)** ở góc trên bên phải.
3. Nhấp vào nút **Load unpacked (Tải tiện ích đã giải nén)**.
4. Chọn thư mục `deploy` của Pine.

### Dành cho Microsoft Edge:
1. Truy cập: `edge://extensions`
2. Bật công tắc **Developer mode**.
3. Nhấp vào **Load unpacked** và chọn thư mục `deploy`.

### Dành cho Mozilla Firefox:
1. Truy cập: `about:debugging#/runtime/this-firefox`
2. Nhấp vào nút **Load Temporary Add-on...**
3. Chọn file `deploy/manifest.json`.

---

## 🛡️ Bản quyền & Mã nguồn
Phát triển theo giấy phép CC0 1.0 Universal (Public Domain). Bạn có toàn quyền sử dụng, tùy chỉnh và phát triển tiếp.
