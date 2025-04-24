const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const config = require('../config/config');
const telegramService = require('../services/telegramService');

// Kiểm tra trạng thái của Telegram Bot
router.get('/status', (req, res) => {
  try {
    const isActive = config.telegramBotToken && 
                     config.telegramBotToken !== 'YOUR_TELEGRAM_BOT_TOKEN';
    
    res.json({
      active: isActive,
      botUsername: isActive ? 'Đang hoạt động' : 'Chưa cấu hình'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cập nhật token Telegram Bot
router.post('/update-token', (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ 
        success: false, 
        message: 'Token không được để trống' 
      });
    }
    
    // Đọc nội dung file .env
    const envFilePath = path.join(__dirname, '../../.env');
    let envContent = fs.readFileSync(envFilePath, 'utf8');
    
    // Cập nhật token trong nội dung
    envContent = envContent.replace(
      /TELEGRAM_BOT_TOKEN=.*/,
      `TELEGRAM_BOT_TOKEN=${token}`
    );
    
    // Ghi lại vào file .env
    fs.writeFileSync(envFilePath, envContent);
    
    res.json({ 
      success: true, 
      message: 'Cập nhật token thành công. Vui lòng khởi động lại server để áp dụng thay đổi.' 
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật token:', error);
    res.status(500).json({ 
      success: false, 
      message: `Lỗi khi cập nhật token: ${error.message}` 
    });
  }
});

// Khởi động lại Telegram Bot
router.post('/restart', (req, res) => {
  try {
    // Đọc lại cấu hình từ file .env
    require('dotenv').config();
    
    // Khởi động lại bot nếu token hợp lệ
    if (config.telegramBotToken && config.telegramBotToken !== 'YOUR_TELEGRAM_BOT_TOKEN') {
      // Khởi tạo lại bot
      const bot = telegramService.initBot();
      
      res.json({ 
        success: true, 
        message: 'Khởi động lại Telegram Bot thành công' 
      });
    } else {
      res.status(400).json({ 
        success: false, 
        message: 'Token không hợp lệ hoặc chưa được cấu hình' 
      });
    }
  } catch (error) {
    console.error('Lỗi khi khởi động lại bot:', error);
    res.status(500).json({ 
      success: false, 
      message: `Lỗi khi khởi động lại bot: ${error.message}` 
    });
  }
});

module.exports = router;
