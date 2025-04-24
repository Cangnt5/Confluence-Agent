# Confluence Agent

Đây là một agent thông minh kết nối với Confluence API, cho phép phân tích nội dung Confluence với AI, phân tích hàng loạt nhiều trang cùng lúc, và tích hợp với Telegram Bot.

## Tính năng

### Phân tích nội dung
- Phân tích hàng loạt nhiều trang Confluence cùng lúc
- Phân tích nội dung với AI (sử dụng OpenAI API)
- Phân tích theo quy tắc (không cần AI)
- Tùy chỉnh prompt cho phân tích AI
- Tổng hợp kết quả phân tích từ nhiều trang

### Tích hợp Telegram
- Bot Telegram để phân tích nội dung Confluence
- Phân tích hàng loạt qua Telegram
- Tùy chỉnh prompt qua lệnh `/set_prompt`
- Quản lý token và cấu hình bot từ giao diện web

## Cài đặt

1. Clone repository:
```
git clone <repository-url>
cd Confluence-Agent
```

2. Cài đặt các dependencies:
```
npm install
```

3. Cấu hình môi trường:
   - Tạo file `.env` từ `.env.example`
   - Cập nhật các thông tin Confluence của bạn

## Cấu hình

Cập nhật file `.env` với thông tin Confluence, OpenAI và Telegram của bạn:

```
CONFLUENCE_BASE_URL=https://your-domain.atlassian.net/wiki
CONFLUENCE_API_TOKEN=your-api-token
CONFLUENCE_USERNAME=your-email@example.com
OPENAI_API_KEY=your-openai-api-key
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
PORT=3000
```

## Chạy ứng dụng

```
npm start
```

Ứng dụng sẽ chạy tại `http://localhost:3000`

## API Endpoints

### Confluence
- `GET /api/confluence/search?query=keyword` - Tìm kiếm trang Confluence
- `GET /api/confluence/page/:id` - Lấy thông tin trang
- `GET /api/confluence/page/:id/children` - Lấy danh sách trang con

### Phân tích
- `POST /api/analysis/batch` - Phân tích hàng loạt nhiều trang
- `POST /api/analysis/summary` - Tạo tóm tắt cho một trang
- `POST /api/analysis/keywords` - Trích xuất từ khóa
- `POST /api/analysis/topics` - Phân tích chủ đề

### Telegram
- `GET /api/telegram/status` - Kiểm tra trạng thái bot
- `POST /api/telegram/update-token` - Cập nhật token bot
- `POST /api/telegram/restart` - Khởi động lại bot
- `GET /api/confluence/page/:id` - Lấy thông tin chi tiết của một trang
- `GET /api/confluence/page/:id/children` - Lấy danh sách các trang con
- `POST /api/confluence/page` - Tạo hoặc cập nhật trang
- `GET /api/confluence/spaces` - Lấy danh sách không gian làm việc

## Ví dụ sử dụng

### Tìm kiếm trang

```bash
curl -X GET "http://localhost:3000/api/confluence/search?query=project"
```

### Lấy thông tin trang

```bash
curl -X GET "http://localhost:3000/api/confluence/page/123456"
```

### Tạo trang mới

```bash
curl -X POST "http://localhost:3000/api/confluence/page" \
  -H "Content-Type: application/json" \
  -d '{
    "spaceKey": "TEAM",
    "title": "Trang mới",
    "content": "<p>Nội dung trang</p>",
    "parentId": "123456"
  }'
```

## Cấu trúc dự án

```
Confluence-Agent/
├── src/
│   ├── api/            # API clients
│   ├── config/         # Cấu hình
│   ├── routes/         # Định nghĩa routes
│   ├── services/       # Logic nghiệp vụ
│   ├── utils/          # Tiện ích
│   └── index.js        # Entry point
├── .env                # Biến môi trường
├── package.json
└── README.md
```
