# XEKO XUKA BULK PUBLISHER
### Hệ Thống Đăng Bài Facebook Hàng Loạt Đa Fanpage (Production Ready)

Hệ thống quản lý và đăng bài Facebook hàng loạt đa Fanpage chuyên nghiệp, cho phép tải lên hàng trăm hoặc hàng nghìn hình ảnh, tự động chia ảnh thành nhiều bài viết (`totalPosts = Math.ceil(totalImages / imagesPerPost)`), chọn nhiều Fanpage nhận bài, dùng chung caption kèm hashtag/emoji và tự động đăng bài theo lịch riêng biệt của từng Fanpage (`scheduledAt = startAt + postIndex * intervalMinutes`).

---

## 🚀 Tính Năng Chính

1. **Quản trị đa Fanpage Facebook**:
   - Tích hợp chuẩn **Meta Graph API v22.0**.
   - Facebook OAuth 2.0 bảo mật với state chống CSRF.
   - Lưu trữ và mã hóa Token Fanpage theo thuật toán **AES-256-GCM** (có Auth Tag chống giả mạo).
   - Tự động phát hiện và cảnh báo Token hết hạn hoặc Fanpage bị mất quyền.

2. **Quy trình tạo chiến dịch 7 bước (Wizard)**:
   - **Bước 1**: Nhập thông tin chiến dịch, mô tả, ngày giờ bắt đầu và múi giờ.
   - **Bước 2**: Tải lên hàng loạt ảnh (hỗ trợ kéo thả, kiểm tra định dạng JPG/JPEG/PNG/WEBP, dung lượng tối đa 20MB, tính checksum SHA-256 chống trùng ảnh).
   - **Bước 3**: Phân nhóm ảnh tự động (1, 5, 10, 20 hoặc tùy chỉnh). Xem trước từng nhóm bài viết.
   - **Bước 4**: Soạn caption dùng chung (hỗ trợ xuống dòng, emoji, hashtag, xem trước mockup bài đăng Facebook).
   - **Bước 5**: Chọn nhiều Fanpage phân phối bài đăng.
   - **Bước 6**: Lên lịch đăng bài (khoảng cách theo phút giữa các bài, tính lịch độc lập cho từng Fanpage).
   - **Bước 7**: Xem trước toàn bộ bảng lịch trình trước khi lưu nháp hoặc bấm chạy.

3. **Hệ thống Queue & Worker (BullMQ + Redis)**:
   - **MongoDB là nguồn dữ liệu sự thật (Single Source of Truth)**.
   - Task Scheduler chạy định kỳ quét MongoDB và đưa task đến hạn vào BullMQ với `jobId` định danh (chống trùng lặp tuyệt đối, phục hồi 100% khi Redis khởi động lại).
   - Publisher Worker: Tải ảnh chưa xuất bản (`published=false`) lên `/{page-id}/photos`, lưu Photo ID theo từng bước (resumable), sau đó tạo Feed bài viết đính kèm `attached_media`.
   - Cơ chế Idempotency: Không bao giờ đăng trùng bài. Hỗ trợ Pause / Resume / Cancel chiến dịch an toàn.

4. **Realtime Socket.IO**:
   - Cập nhật tiến độ đăng bài, trạng thái từng Fanpage theo thời gian thực không cần tải lại trang.

5. **Lịch sử đăng bài & Calendar view**:
   - Xem lịch theo ngày, lọc theo Fanpage, trạng thái.
   - Lưu trữ Facebook Post ID, link bài viết trực tiếp trên Facebook.
   - Xuất báo cáo lịch sử ra file CSV.

---

## 🛠 Công Nghệ Sử Dụng

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons, React Router v7, Zustand, Axios, Socket.IO Client.
- **Backend**: Node.js LTS, Express, TypeScript, MongoDB (Mongoose), Redis, BullMQ, Socket.IO, AES-256-GCM Crypto, Zod.
- **Testing**: Vitest, In-memory MongoDB (`mongodb-memory-server`), Mock Meta Graph API.
- **Deployment**: Docker, Docker Compose, Nginx Reverse Proxy.

---

## ⚙️ Hướng Dẫn Cài Đặt & Chạy Môi Trường Local

### Bước 1: Yêu cầu môi trường
- Node.js >= 18 LTS (Khuyến nghị Node.js 20 hoặc 22)
- MongoDB (hoặc Docker chạy Mongo)
- Redis (hoặc Docker chạy Redis)

### Bước 2: Clone repository & Cấu hình môi trường
```bash
git clone <repo-url>
cd dangbaifacebook
cp .env.example .env
```

Chỉnh sửa file `.env` với các thông số của bạn:
```env
PORT=5000
CLIENT_URL=http://localhost:5173
MONGO_URI=mongodb://localhost:27017/xeko_publisher
REDIS_URL=redis://localhost:6379
JWT_SECRET=super-secret-jwt-key-min-32-chars-long!
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# Facebook App Credentials
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
FACEBOOK_REDIRECT_URI=http://localhost:5000/api/v1/facebook/oauth/callback
FACEBOOK_GRAPH_VERSION=v22.0
```

### Bước 3: Cài đặt dependencies và chạy Backend
```bash
cd backend
npm install
npm run dev
```
Backend API sẽ khởi động tại `http://localhost:5000` (API endpoint: `http://localhost:5000/api/v1`).

### Bước 4: Chạy Frontend
Mở một terminal mới:
```bash
cd frontend
npm install
npm run dev
```
Frontend Vite sẽ chạy tại `http://localhost:5173`.

---

## 🧪 Chạy Kiểm Thử (Tests)

Hệ thống có bộ kiểm thử Unit & Integration tự động kiểm tra toàn bộ 21 trường hợp logic (sử dụng in-memory MongoDB và Mock Meta Graph API server):
```bash
cd backend
npm test
```

---

## 🌐 Hướng Dẫn Cấu Hình Facebook Developer App

1. Truy cập [developers.facebook.com](https://developers.facebook.com) và bấm **Create App**.
2. Chọn loại ứng dụng: **Business** (Doanh nghiệp).
3. Đặt tên ứng dụng (ví dụ: `Xeko Bulk Publisher`).
4. Thêm sản phẩm **Facebook Login for Business**.
5. Trong cài đặt Facebook Login:
   - Thêm **Valid OAuth Redirect URIs**:
     - Local: `http://localhost:5000/api/v1/facebook/oauth/callback`
     - Production: `https://yourdomain.com/api/v1/facebook/oauth/callback`
6. Trong mục **App Review / Permissions**:
   - Yêu cầu các quyền:
     - `pages_show_list`
     - `pages_read_engagement`
     - `pages_manage_posts`
7. Copy **App ID** và **App Secret** dán vào file `.env`.

---

## 🐳 Triển Khai Bằng Docker & Docker Compose Trên VPS

### Bước 1: Chuẩn bị VPS Ubuntu
Cài đặt Docker và Docker Compose trên VPS:
```bash
sudo apt update && sudo apt install -y docker.io docker-compose
sudo systemctl enable --now docker
```

### Bước 2: Khởi chạy toàn bộ hệ thống
```bash
docker-compose up -d --build
```

Lệnh trên sẽ tự động khởi tạo:
- `xeko-mongodb`: Cơ sở dữ liệu MongoDB có persistent volume
- `xeko-redis`: Bộ nhớ đệm Redis & BullMQ Queue
- `xeko-backend`: Node.js API Server + Worker + Scheduler
- `xeko-frontend`: Ứng dụng React build sẵn
- `xeko-nginx-proxy`: Nginx Reverse Proxy tiếp nhận port 80/443

---

## ✅ Báo Cáo Tiêu Chuẩn Hoàn Thành

- [x] **Frontend**: Giao diện SaaS Dashboard hoàn chỉnh, đầy đủ 10 menu, responsive, không mockup sơ sài.
- [x] **Backend**: Kiến trúc Controller - Service - Model - Validator - Route phân tách rõ ràng.
- [x] **MongoDB**: Mongoose Models đầy đủ, index chống trùng `campaignId + postId + pageId`.
- [x] **Redis & BullMQ**: Queue quản lý concurrency, tự động retry với exponential backoff.
- [x] **Task Scheduler**: Quét lịch định kỳ từ MongoDB, chống bỏ sót task khi server hoặc Redis restart.
- [x] **Facebook OAuth & Graph API**: Tích hợp chuẩn v22.0, mã hóa AES-256-GCM token an toàn, upload ảnh `published=false` rồi tạo Feed với `attached_media`.
- [x] **Media Storage**: Hỗ trợ tải lên nhiều ảnh cùng lúc, tính checksum chống trùng lặp file.
- [x] **Chiến dịch & Lịch đăng**: Wizard 7 bước, thuật toán chia nhóm và lên lịch độc lập từng Fanpage.
- [x] **Điều khiển**: Hỗ trợ Tạm dừng (Pause), Tiếp tục (Resume), Hủy (Cancel), Thử lại (Retry).
- [x] **Realtime Socket.IO**: Tự động thông báo và cập nhật tiến độ đăng bài.
- [x] **Kiểm thử**: Đầy đủ Unit & Integration Tests với Vitest và Mock Meta API.
- [x] **Triển khai**: Docker Compose, Dockerfile, Nginx config và hướng dẫn chi tiết.

