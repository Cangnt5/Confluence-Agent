const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const path = require('path');

// Khởi động lại server
router.post('/restart', (req, res) => {
  try {
    // Gửi phản hồi trước khi khởi động lại
    res.json({ 
      success: true, 
      message: 'Server đang được khởi động lại...' 
    });
    
    // Thực hiện khởi động lại server sau 1 giây
    setTimeout(() => {
      const serverPath = path.join(__dirname, '../../');
      
      // Sử dụng pm2 nếu có, nếu không thì khởi động lại bằng node
      exec('command -v pm2 && pm2 restart all || (cd "' + serverPath + '" && npm restart)', 
        (error, stdout, stderr) => {
          if (error) {
            console.error(`Lỗi khi khởi động lại server: ${error.message}`);
            return;
          }
          if (stderr) {
            console.error(`Stderr: ${stderr}`);
            return;
          }
          console.log(`Server đã được khởi động lại: ${stdout}`);
        }
      );
    }, 1000);
  } catch (error) {
    console.error('Lỗi khi khởi động lại server:', error);
    res.status(500).json({ 
      success: false, 
      message: `Lỗi khi khởi động lại server: ${error.message}` 
    });
  }
});

module.exports = router;
