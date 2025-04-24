const TelegramBot = require('node-telegram-bot-api');
const config = require('../config/config');
const confluenceService = require('./confluenceService');
const aiService = require('./aiService');
const batchAnalysisService = require('./batchAnalysisService');
const urlParser = require('../utils/urlParser');

// Khởi tạo bot với token từ biến môi trường
const bot = new TelegramBot(config.telegramBotToken, { polling: true });

// Lưu trữ trạng thái của người dùng
const userStates = {};

// Khởi tạo bot và xử lý các lệnh
function initBot() {
  console.log('Khởi tạo Telegram Bot...');

  // Xử lý lệnh /start
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(
      chatId,
      'Chào mừng đến với Confluence Agent Bot! 🤖\n\n' +
      'Bot này giúp bạn phân tích nội dung trang Confluence với AI.\n\n' +
      'Các lệnh có sẵn:\n' +
      '/analyze_batch - Phân tích một hoặc nhiều URL cùng lúc\n' +
      '/prompt <prompt> - Đặt prompt cho AI\n' +
      '/set_prompt <prompt> - Đặt prompt cho AI (tương tự /prompt)\n' +
      '/help - Hiển thị trợ giúp'
    );
  });

  // Xử lý lệnh /help
  bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(
      chatId,
      'Hướng dẫn sử dụng Confluence Agent Bot:\n\n' +
      '1. Sử dụng lệnh /analyze_batch để phân tích một hoặc nhiều URL\n' +
      '2. Sử dụng lệnh /set_prompt để đặt prompt tùy chỉnh cho AI\n' +
      '3. Gửi nhiều URL (mỗi URL một dòng) sau khi gọi /analyze_batch\n' +
      '4. Bạn có thể tiếp tục đặt câu hỏi về nội dung trang sau khi đã phân tích\n\n' +
      'Các lệnh có sẵn:\n' +
      '/analyze_batch - Phân tích một hoặc nhiều URL cùng lúc\n' +
      '/prompt <prompt> - Đặt prompt cho AI\n' +
      '/set_prompt <prompt> - Đặt prompt cho AI (tương tự /prompt)\n' +
      '/help - Hiển thị trợ giúp\n\n' +
      'Ví dụ prompt:\n' +
      '/set_prompt So sánh các tính năng được mô tả trong các trang này và đưa ra đề xuất\n' +
      '/set_prompt Tổng hợp các vấn đề và giải pháp từ các trang này'
    );
  });


  // Xử lý lệnh /prompt
  bot.onText(/\/prompt (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const newPrompt = match[1].trim();
    
    if (!userStates[chatId]) {
      return bot.sendMessage(
        chatId, 
        'Vui lòng phân tích một trang Confluence trước bằng lệnh /analyze_batch <URL>'
      );
    }
    
    // Lưu prompt mới cho người dùng
    userStates[chatId].lastPrompt = newPrompt;
    
    bot.sendMessage(
      chatId,
      `✅ *Đã cập nhật prompt thành công*\n\nPrompt mới: "${newPrompt}"\n\nBạn có thể sử dụng /analyze_batch để phân tích trang Confluence với prompt này.`,
      { parse_mode: 'Markdown' }
    );
    
    // Nếu đã có nội dung trang, phân tích lại với prompt mới
    if (userStates[chatId].content) {
      try {
        bot.sendMessage(chatId, 'Đang phân tích lại trang với prompt mới...');
        
        // Tạo phân tích mới với prompt mới
        const analysis = await aiService.generateAiSummary(
          userStates[chatId].content, 
          newPrompt
        );
        
        // Gửi kết quả
        bot.sendMessage(
          chatId,
          `📄 *${userStates[chatId].pageTitle}*\n\n${analysis}\n\n` +
          '_Bạn có thể đặt câu hỏi thêm về nội dung trang này hoặc sử dụng /prompt để đặt prompt mới._',
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        console.error('Lỗi khi xử lý prompt:', error);
        bot.sendMessage(chatId, `Đã xảy ra lỗi: ${error.message}`);
      }
    }
  });

  // Xử lý tin nhắn thông thường (câu hỏi về nội dung)
  bot.on('message', async (msg) => {
    // Bỏ qua các lệnh
    if (msg.text && msg.text.startsWith('/')) return;
    
    const chatId = msg.chat.id;
    const userQuestion = msg.text;
    
    if (!userStates[chatId]) {
      return bot.sendMessage(
        chatId, 
        'Vui lòng phân tích một trang Confluence trước bằng lệnh /analyze_batch <URL>'
      );
    }
    
    try {
      bot.sendMessage(chatId, 'Đang xử lý câu hỏi của bạn...');
      
      // Tạo prompt mới dựa trên câu hỏi của người dùng
      const questionPrompt = `Dựa trên nội dung trang Confluence, hãy trả lời câu hỏi sau: ${userQuestion}`;
      
      // Lưu prompt mới
      userStates[chatId].lastPrompt = questionPrompt;
      
      // Tạo phân tích mới với prompt mới
      const answer = await aiService.generateAiSummary(
        userStates[chatId].content, 
        questionPrompt
      );
      
      // Gửi kết quả
      bot.sendMessage(
        chatId,
        `📄 *${userStates[chatId].pageTitle}*\n\n${answer}`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      console.error('Lỗi khi xử lý câu hỏi:', error);
      bot.sendMessage(chatId, `Đã xảy ra lỗi: ${error.message}`);
    }
  });

  console.log('Telegram Bot đã được khởi tạo thành công!');
  // Xử lý lệnh /set_prompt (tương tự /prompt nhưng dễ hiểu hơn)
  bot.onText(/\/set_prompt (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const newPrompt = match[1].trim();
    
    // Lưu prompt mới cho người dùng
    userStates[chatId] = {
      ...userStates[chatId],
      lastPrompt: newPrompt
    };
    
    bot.sendMessage(
      chatId,
      `✅ *Đã cập nhật prompt thành công*\n\nPrompt mới: "${newPrompt}"\n\nBạn có thể sử dụng /analyze_batch để phân tích trang Confluence với prompt này.`,
      { parse_mode: 'Markdown' }
    );
  });
  
  // Xử lý lệnh /analyze_batch
  bot.onText(/\/analyze_batch(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    
    // Kiểm tra xem đã có URL trong lệnh chưa
    const urlInput = match && match[1] ? match[1].trim() : null;
    
    if (urlInput) {
      // Nếu có URL trong lệnh, xử lý ngay
      try {
        bot.sendMessage(chatId, 'Đang phân tích URL...');
        
        // Phân tích URL đơn
        const urls = [urlInput];
        const results = await batchAnalysisService.analyzeBatch(urls, {
          useAi: true,
          customPrompt: userStates[chatId]?.lastPrompt || 'Tóm tắt nội dung trang này một cách ngắn gọn.'
        });
        
        if (results.successCount > 0) {
          const result = results.results[0];
          
          // Lưu trữ nội dung trang vào trạng thái người dùng để có thể hỏi thêm
          userStates[chatId] = {
            pageId: result.pageId,
            pageTitle: result.pageTitle,
            content: result.content,
            lastPrompt: 'Tóm tắt nội dung trang này một cách ngắn gọn.'
          };
          
          // Gửi kết quả
          bot.sendMessage(
            chatId,
            `📄 *${result.pageTitle}*\n` +
            `ID: ${result.pageId}\n\n` +
            `${result.summary}\n\n` +
            `🔗 [Xem trang gốc](${result.url})\n\n` +
            '_Bạn có thể đặt câu hỏi thêm về nội dung trang này._',
            { parse_mode: 'Markdown' }
          );
        } else if (results.errors.length > 0) {
          bot.sendMessage(chatId, `⚠️ Lỗi: ${results.errors[0].error}`, { parse_mode: 'Markdown' });
        }
      } catch (error) {
        console.error('Lỗi khi phân tích URL:', error);
        bot.sendMessage(chatId, `Đã xảy ra lỗi: ${error.message}`);
      }
    } else {
      // Nếu không có URL, yêu cầu người dùng gửi danh sách URL
      userStates[chatId] = {
        ...userStates[chatId],
        waitingForBatchUrls: true,
        lastPrompt: 'Tóm tắt nội dung trang này một cách ngắn gọn.' // Prompt mặc định
      };
      
      bot.sendMessage(
        chatId,
        'Vui lòng gửi danh sách URL hoặc ID trang Confluence (mỗi URL một dòng).\n\n' +
        'Ví dụ:\nhttps://example.atlassian.net/wiki/spaces/ABC/pages/123456\nhttps://example.atlassian.net/wiki/spaces/ABC/pages/789012\n\n' +
        'Hoặc bạn có thể gửi danh sách ID trang:\n123456\n789012\n\n' +
        'Hoặc gửi một URL duy nhất:\n/analyze_batch https://example.atlassian.net/wiki/spaces/ABC/pages/123456',
        { parse_mode: 'Markdown' }
      );
    }
  });
  
  // Xử lý khi nhận danh sách URL cho phân tích hàng loạt
  bot.on('message', async (msg) => {
    // Bỏ qua các lệnh
    if (msg.text && msg.text.startsWith('/')) return;
    
    const chatId = msg.chat.id;
    const messageText = msg.text;
    
    // Kiểm tra xem người dùng có đang chờ gửi danh sách URL không
    if (userStates[chatId] && userStates[chatId].waitingForBatchUrls) {
      // Đặt lại trạng thái chờ URL
      userStates[chatId].waitingForBatchUrls = false;
      
      // Kiểm tra xem tin nhắn có chứa danh sách URL không
      const urls = messageText.split('\n').filter(url => url.trim() !== '');
      
      if (urls.length === 0) {
        return bot.sendMessage(chatId, 'Không tìm thấy URL nào. Vui lòng thử lại với /analyze_batch');
      }
      
      try {
        bot.sendMessage(chatId, `Đang phân tích ${urls.length} URL. Quá trình này có thể mất một chút thời gian...`);
        
        // Phân tích hàng loạt
        const results = await batchAnalysisService.analyzeBatch(urls, {
          useAi: true,
          customPrompt: userStates[chatId]?.lastPrompt || 'Tóm tắt nội dung trang này một cách ngắn gọn.'
        });
        
        // Gửi thống kê
        bot.sendMessage(
          chatId,
          `📊 *Kết quả phân tích hàng loạt*\n\n` +
          `• Tổng số URL: ${results.totalProcessed}\n` +
          `• Thành công: ${results.successCount}\n` +
          `• Lỗi: ${results.errorCount}\n\n` +
          `Đang gửi kết quả phân tích...`,
          { parse_mode: 'Markdown' }
        );
        
        // Gửi kết quả phân tích tổng hợp nếu có
        if (results.combinedAnalysis) {
          await bot.sendMessage(
            chatId,
            `🤖 *Phân tích tổng hợp dựa trên prompt*\n\n${results.combinedAnalysis}`,
            { parse_mode: 'Markdown' }
          );
          
          // Đợi một chút để tránh giới hạn tốc độ của Telegram
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Gửi kết quả cho từng URL thành công
        for (const result of results.results) {
          // Kiểm tra nếu summary là 'Sẽ được phân tích trong kết quả tổng hợp'
          if (result.summary === 'Sẽ được phân tích trong kết quả tổng hợp' && results.combinedAnalysis) {
            continue; // Bỏ qua vì đã được phân tích trong kết quả tổng hợp
          }
          
          await bot.sendMessage(
            chatId,
            `📄 *${result.pageTitle}*\n` +
            `ID: ${result.pageId}\n\n` +
            `${result.summary}\n\n` +
            `🔗 [Xem trang gốc](${result.url})`,
            { parse_mode: 'Markdown' }
          );
          
          // Đợi một chút giữa các tin nhắn để tránh giới hạn tốc độ của Telegram
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Gửi danh sách lỗi nếu có
        if (results.errors.length > 0) {
          let errorMessage = '⚠️ *Các lỗi gặp phải:*\n\n';
          
          results.errors.forEach(error => {
            errorMessage += `• ${error.url}: ${error.error}\n`;
          });
          
          bot.sendMessage(chatId, errorMessage, { parse_mode: 'Markdown' });
        }
        
        // Kết thúc
        bot.sendMessage(
          chatId,
          'Phân tích hàng loạt hoàn tất. Bạn có thể sử dụng /analyze_batch để phân tích thêm URL hoặc /prompt để đặt prompt mới.',
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        console.error('Lỗi khi phân tích hàng loạt:', error);
        bot.sendMessage(chatId, `Đã xảy ra lỗi: ${error.message}`);
      }
      return;
    }
    
    // Xử lý các tin nhắn thông thường (câu hỏi về nội dung)
    // Chỉ xử lý nếu không phải là phân tích hàng loạt
    if (userStates[chatId] && userStates[chatId].content) {
      const userQuestion = messageText;
      
      try {
        bot.sendMessage(chatId, 'Đang xử lý câu hỏi của bạn...');
        
        // Tạo prompt mới dựa trên câu hỏi của người dùng
        const questionPrompt = `Dựa trên nội dung trang Confluence, hãy trả lời câu hỏi sau: ${userQuestion}`;
        
        // Lưu prompt mới
        userStates[chatId].lastPrompt = questionPrompt;
        
        // Tạo phân tích mới với prompt mới
        const answer = await aiService.generateAiSummary(
          userStates[chatId].content, 
          questionPrompt
        );
        
        // Gửi kết quả
        bot.sendMessage(
          chatId,
          `📄 *${userStates[chatId].pageTitle}*\n\n${answer}`,
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        console.error('Lỗi khi xử lý câu hỏi:', error);
        bot.sendMessage(chatId, `Đã xảy ra lỗi: ${error.message}`);
      }
    }
  });

  console.log('Telegram Bot đã được khởi tạo thành công!');
  return bot;
}

module.exports = {
  initBot
};
