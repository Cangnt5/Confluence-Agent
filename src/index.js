const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config/config');
const confluenceRoutes = require('./routes/confluenceRoutes');
const analysisRoutes = require('./routes/analysisRoutes');
const aiRoutes = require('./routes/aiRoutes');
const telegramRoutes = require('./routes/telegramRoutes');
const systemRoutes = require('./routes/systemRoutes');
const telegramService = require('./services/telegramService');

// Khởi tạo ứng dụng Express
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Phục vụ trang HTML tĩnh
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/api/confluence', confluenceRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/system', systemRoutes);

// Khởi tạo Telegram Bot nếu token được cung cấp
if (config.telegramBotToken && config.telegramBotToken !== 'YOUR_TELEGRAM_BOT_TOKEN') {
  try {
    const bot = telegramService.initBot();
    console.log('Telegram Bot đã được kích hoạt thành công!');
  } catch (error) {
    console.error('Lỗi khi khởi tạo Telegram Bot:', error.message);
  }
} else {
  console.log('Telegram Bot không được kích hoạt. Vui lòng cung cấp TELEGRAM_BOT_TOKEN trong file .env');
}

// Route mặc định
app.get('/', (req, res) => {
  res.json({
    message: 'Confluence Agent API',
    version: '1.0.0',
    endpoints: [
      // Confluence endpoints
      { method: 'GET', path: '/api/confluence/search', description: 'Tìm kiếm trang Confluence' },
      { method: 'GET', path: '/api/confluence/page/:id', description: 'Lấy thông tin chi tiết của một trang' },
      { method: 'GET', path: '/api/confluence/page/:id/children', description: 'Lấy danh sách các trang con' },
      { method: 'POST', path: '/api/confluence/page', description: 'Tạo hoặc cập nhật trang' },
      { method: 'GET', path: '/api/confluence/spaces', description: 'Lấy danh sách không gian làm việc' },
      
      // Analysis endpoints
      { method: 'POST', path: '/api/analysis/keywords', description: 'Trích xuất từ khóa từ nội dung trang' },
      { method: 'POST', path: '/api/analysis/topics', description: 'Trích xuất chủ đề chính từ nội dung trang' },
      { method: 'POST', path: '/api/analysis/summary', description: 'Tạo tóm tắt tự động cho trang' },
      { method: 'POST', path: '/api/analysis/structure', description: 'Phân tích cấu trúc trang' },
      
      // AI endpoints
      { method: 'POST', path: '/api/ai/answer', description: 'Trả lời câu hỏi dựa trên nội dung trang' },
      { method: 'POST', path: '/api/ai/generate-content', description: 'Tạo nội dung mới dựa trên template' },
      { method: 'POST', path: '/api/ai/analyze-quality', description: 'Phân tích chất lượng nội dung và đưa ra đề xuất' }
    ]
  });
});

// Xử lý lỗi 404
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint không tồn tại' });
});

// Xử lý lỗi chung
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Lỗi máy chủ nội bộ' });
});

// Khởi động server
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`Confluence Agent đang chạy trên cổng ${PORT}`);
  
  // Khởi tạo Telegram Bot nếu token được cung cấp
  if (config.telegramBotToken && config.telegramBotToken !== 'YOUR_TELEGRAM_BOT_TOKEN') {
    try {
      telegramService.initBot();
      console.log('Telegram Bot đã được khởi động thành công!');
    } catch (error) {
      console.error('Lỗi khi khởi động Telegram Bot:', error);
    }
  } else {
    console.log('Telegram Bot không được khởi động do thiếu token hoặc token chưa được cấu hình.');
  }
});
