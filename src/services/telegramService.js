const TelegramBot = require('node-telegram-bot-api');
const config = require('../config/config');
const confluenceService = require('./confluenceService');
const aiService = require('./aiService');
const batchAnalysisService = require('./batchAnalysisService');
const urlParser = require('../utils/urlParser');

// Lưu trữ trạng thái của người dùng
const userStates = {};

// Biến để theo dõi tin nhắn đã xử lý
const processedMessages = {};

// Biến để theo dõi xem bot đã được khởi tạo chưa
let botInitialized = false;

// Khởi tạo bot và xử lý các lệnh
function initBot() {
  // Tránh khởi tạo nhiều lần
  if (botInitialized) {
    console.log('Telegram Bot đã được khởi tạo trước đó, bỏ qua.');
    return;
  }
  
  botInitialized = true;
  console.log('Khởi tạo Telegram Bot...');

  // Khởi tạo bot với token từ biến môi trường và các tùy chọn
  let bot = null;
  
  try {
    bot = new TelegramBot(config.telegramBotToken, { 
      polling: true,
      polling_interval: 300,
      request: {
        timeout: 30000
      }
    });
  } catch (error) {
    console.error('Lỗi khi khởi tạo Telegram Bot:', error);
    return null;
  }

  // Xử lý lệnh /start
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(
      chatId,
      'Chào mừng đến với Confluence Agent Bot! 🤖\n\n' +
      'Bot này giúp bạn phân tích nội dung trang Confluence với AI, hỗ trợ phân tích nhiều trang cùng lúc và tổng hợp kết quả dựa trên prompt tùy chỉnh.\n\n' +
      'Các lệnh có sẵn:\n' +
      '/analyze_batch - Phân tích một hoặc nhiều URL cùng lúc\n' +
      '/set_prompt <prompt> - Đặt prompt tùy chỉnh cho AI\n' +
      '/prompt <prompt> - Đặt prompt tùy chỉnh (tương tự /set_prompt)\n' +
      '/help - Hiển thị trợ giúp\n\n' +
      '📝 Ví dụ: Gửi /analyze_batch, sau đó dán nhiều URL (mỗi URL một dòng)'
    );
  });

  // Xử lý lệnh /help
  bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(
      chatId,
      'Hướng dẫn sử dụng Confluence Agent Bot:\n\n' +
      '📋 *Phân tích một trang Confluence*\n' +
      '1. Gửi lệnh: /analyze_batch\n' +
      '2. Gửi URL của trang Confluence\n' +
      '3. Bot sẽ phân tích và trả về tóm tắt, từ khóa và các thông tin khác\n\n' +
      '📚 *Phân tích nhiều trang với prompt tùy chỉnh*\n' +
      '1. Đặt prompt tùy chỉnh: /set_prompt <prompt của bạn>\n' +
      '2. Gửi lệnh: /analyze_batch\n' +
      '3. Gửi danh sách URL (mỗi URL một dòng)\n' +
      '4. Bot sẽ phân tích tất cả các trang và trả về kết quả tổng hợp\n\n' +
      '🔍 *Các lệnh có sẵn*\n' +
      '/analyze_batch - Phân tích một hoặc nhiều URL cùng lúc\n' +
      '/set_prompt <prompt> - Đặt prompt tùy chỉnh cho AI\n' +
      '/prompt <prompt> - Đặt prompt tùy chỉnh (tương tự /set_prompt)\n' +
      '/help - Hiển thị trợ giúp\n\n' +
      '💡 *Ví dụ prompt hiệu quả*\n' +
      '/set_prompt So sánh các tính năng được mô tả trong các trang này và đưa ra đề xuất\n' +
      '/set_prompt Tổng hợp các vấn đề và giải pháp từ các trang này\n' +
      '/set_prompt Phân tích các tính năng được mô tả trong các trang, so sánh ưu và nhược điểm, và đề xuất cách cải thiện',
      { parse_mode: 'Markdown' }
    );
  });

  // Hàm xử lý tin nhắn chung để tránh trùng lặp
  const processMessage = async (msg, handler) => {
    if (!msg.text) return;
    
    const chatId = msg.chat.id;
    const messageId = msg.message_id;
    
    // Tạo ID duy nhất cho mỗi tin nhắn
    const uniqueId = `${chatId}_${messageId}`;
    
    // Kiểm tra nếu tin nhắn đã được xử lý
    if (processedMessages[uniqueId]) {
      console.log(`Tin nhắn ${uniqueId} đã được xử lý, bỏ qua`);
      return;
    }
    
    // Đánh dấu tin nhắn đã được xử lý
    processedMessages[uniqueId] = true;
    
    // Giới hạn kích thước của processedMessages
    const keys = Object.keys(processedMessages);
    if (keys.length > 1000) {
      const oldestKey = keys[0];
      delete processedMessages[oldestKey];
    }
    
    // Gọi handler để xử lý tin nhắn
    await handler(msg);
  };

  // Xử lý lệnh /set_prompt
  bot.onText(/\/set_prompt (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const newPrompt = match[1].trim();
    
    // Lưu prompt mới cho người dùng
    userStates[chatId] = {
      ...userStates[chatId],
      lastPrompt: newPrompt
    };
    
    // Escape các ký tự đặc biệt cho MarkdownV2
    const escapedPrompt = newPrompt.replace(/[_*\[\]()~`>#+\-=|{}.!]/g, '\\$&');
    
    bot.sendMessage(
      chatId,
      `✅ *Đã cập nhật prompt thành công*\n\nPrompt mới: "${escapedPrompt}"\n\n` +
      `💡 *Cách sử dụng*: Gửi lệnh /analyze_batch, sau đó gửi danh sách URL (mỗi URL một dòng) để phân tích với prompt này.`,
      { parse_mode: 'Markdown' }
    );
  });
  
  // Xử lý lệnh /prompt không có tham số
  bot.onText(/\/prompt$/, async (msg) => {
    const chatId = msg.chat.id;
    
    // Hiển thị prompt hiện tại nếu có
    const currentPrompt = userStates[chatId]?.lastPrompt || 'Tóm tắt nội dung trang này một cách ngắn gọn.';
    
    bot.sendMessage(
      chatId,
      `💬 *Prompt hiện tại*\n\n"${currentPrompt}"\n\n` +
      `Để thay đổi prompt, sử dụng lệnh: /set_prompt <prompt mới>\n\n` +
      `💡 *Ví dụ prompt hiệu quả*:\n` +
      `- /set_prompt So sánh các tính năng được mô tả trong các trang này\n` +
      `- /set_prompt Tổng hợp các vấn đề và giải pháp từ các trang này\n` +
      `- /set_prompt Phân tích ưu và nhược điểm của các tính năng được mô tả`,
      { parse_mode: 'Markdown' }
    );
  });
  
  // Xử lý lệnh /prompt với tham số
  bot.onText(/\/prompt (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const newPrompt = match[1].trim();
    
    // Lưu prompt mới cho người dùng
    userStates[chatId] = {
      ...userStates[chatId],
      lastPrompt: newPrompt
    };
    
    bot.sendMessage(
      chatId,
      `✅ *Đã cập nhật prompt thành công*\n\nPrompt mới: "${newPrompt}"\n\n` +
      `💡 *Cách sử dụng*: Gửi lệnh /analyze_batch, sau đó gửi danh sách URL (mỗi URL một dòng) để phân tích với prompt này.`,
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
        bot.sendMessage(chatId, '🔎 Đang phân tích URL... Vui lòng đợi trong giây lát.');
        
        // Phân tích URL đơn
        const urls = [urlInput];
        const results = await batchAnalysisService.analyzeBatch(urls, {
          useAi: true,
          customPrompt: userStates[chatId]?.lastPrompt || 'Tóm tắt nội dung trang này một cách ngắn gọn.'
        });
        
        // Kiểm tra nếu có kết quả tổng hợp
        if (results.combinedAnalysis) {
          await bot.sendMessage(
            chatId,
            `🤖 *Phân tích dựa trên prompt*\n\n${results.combinedAnalysis}\n\n` +
            `🔗 Xem trang gốc: ${results.results[0].url}`,
            { parse_mode: 'Markdown' }
          );
          
          // Lưu trữ nội dung trang vào trạng thái người dùng để có thể hỏi thêm
          userStates[chatId] = {
            pageId: results.results[0].pageId,
            pageTitle: results.results[0].pageTitle,
            content: results.results[0].content,
            lastPrompt: userStates[chatId]?.lastPrompt || 'Tóm tắt nội dung trang này một cách ngắn gọn.'
          };
        } 
        // Nếu không có kết quả tổng hợp, hiển thị kết quả từng trang
        else if (results.successCount > 0) {
          const result = results.results[0];
          
          // Lưu trữ nội dung trang vào trạng thái người dùng để có thể hỏi thêm
          userStates[chatId] = {
            pageId: result.pageId,
            pageTitle: result.pageTitle,
            content: result.content,
            lastPrompt: userStates[chatId]?.lastPrompt || 'Tóm tắt nội dung trang này một cách ngắn gọn.'
          };
          
          // Gửi kết quả
          bot.sendMessage(
            chatId,
            `📝 *${result.pageTitle}*\n` +
            `ID: ${result.pageId}\n\n` +
            `${result.summary}\n\n` +
            `🔗 Xem trang gốc: ${result.url}\n\n` +
            '💬 Bạn có thể đặt câu hỏi thêm về nội dung trang này.',
            { parse_mode: 'Markdown' }
          );
        } else if (results.errors.length > 0) {
          bot.sendMessage(chatId, `⚠️ *Lỗi khi phân tích*\n\n${results.errors[0].error}`, { parse_mode: 'Markdown' });
        }
      } catch (error) {
        console.error('Lỗi khi phân tích URL:', error);
        bot.sendMessage(chatId, `⚠️ *Đã xảy ra lỗi*\n\n${error.message}`, { parse_mode: 'Markdown' });
      }
    } else {
      // Nếu không có URL, yêu cầu người dùng gửi danh sách URL
      userStates[chatId] = {
        ...userStates[chatId],
        waitingForBatchUrls: true,
        lastPrompt: userStates[chatId]?.lastPrompt || 'Tóm tắt nội dung trang này một cách ngắn gọn.' // Sử dụng prompt hiện tại hoặc mặc định
      };
      
      bot.sendMessage(
        chatId,
        '📝 *Phân tích nhiều trang Confluence*\n\n' +
        'Vui lòng gửi danh sách URL hoặc ID trang Confluence (mỗi URL một dòng).\n\n' +
        '👉 *Ví dụ:*\n```\nhttps://your-domain.atlassian.net/wiki/spaces/ABC/pages/123456\nhttps://your-domain.atlassian.net/wiki/spaces/ABC/pages/789012\n```\n\n' +
        '💡 *Mẹo:* Bạn có thể đặt prompt tùy chỉnh trước bằng lệnh `/set_prompt`',
        { parse_mode: 'Markdown' }
      );
    }
  });

  // Xử lý tin nhắn thông thường
  // Hàm escape các ký tự đặc biệt cho MarkdownV2
  const escapeMarkdown = (text) => {
    if (!text) return '';
    return text.replace(/[_*\[\]()~`>#+\-=|{}.!]/g, '\\$&');
  };
  
  bot.on('message', (msg) => {
    // Bỏ qua các lệnh
    if (msg.text && msg.text.startsWith('/')) return;
    
    processMessage(msg, async (msg) => {
      const chatId = msg.chat.id;
      const messageText = msg.text;
      
      // Kiểm tra nếu người dùng đang chờ xem chi tiết
      if (userStates[chatId] && userStates[chatId].waitingForDetailView) {
        // Xóa trạng thái chờ
        userStates[chatId].waitingForDetailView = false;
        
        // Nếu người dùng muốn xem chi tiết
        if (messageText.toLowerCase() === 'xem chi tiết') {
          const results = userStates[chatId].batchResults;
          
          if (results && results.results) {
            await bot.sendMessage(chatId, '📝 *Kết quả chi tiết cho từng trang*', { parse_mode: 'Markdown' });
            
            // Gửi kết quả cho từng URL thành công
            for (const result of results.results) {
              await bot.sendMessage(
                chatId,
                `📝 *${result.pageTitle}*\n` +
                `ID: ${result.pageId}\n\n` +
                `${result.summary}\n\n` +
                `🔗 [Xem trang gốc](${result.url})`,
                { parse_mode: 'Markdown' }
              );
              
              // Đợi một chút giữa các tin nhắn để tránh giới hạn tốc độ của Telegram
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          } else {
            bot.sendMessage(chatId, '⚠️ Không còn lưu kết quả chi tiết. Vui lòng phân tích lại.');
          }
          
          // Xóa kết quả hàng loạt để tiết kiệm bộ nhớ
          delete userStates[chatId].batchResults;
          return;
        }
        
        // Xóa kết quả hàng loạt để tiết kiệm bộ nhớ
        delete userStates[chatId].batchResults;
        return; // Tránh xử lý tin nhắn này như một câu hỏi thông thường
      }
      
      // Kiểm tra xem người dùng có đang chờ gửi danh sách URL không
      if (userStates[chatId] && userStates[chatId].waitingForBatchUrls) {
        // Xử lý danh sách URL sẽ được xử lý bởi handler riêng
        return;
      }
      
      // Xử lý câu hỏi thông thường
      if (!userStates[chatId] || !userStates[chatId].content) {
        return bot.sendMessage(
          chatId, 
          '💬 Vui lòng phân tích một trang Confluence trước bằng lệnh /analyze_batch <URL>'
        );
      }
      
      try {
        bot.sendMessage(chatId, '🤖 Đang xử lý câu hỏi của bạn...');
        
        // Tạo prompt mới dựa trên câu hỏi của người dùng
        const questionPrompt = `Dựa trên nội dung trang Confluence, hãy trả lời câu hỏi sau: ${messageText}`;
        
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
          `📝 *${userStates[chatId].pageTitle}*\n\n${answer}\n\n` +
          `👉 Bạn có thể tiếp tục đặt câu hỏi hoặc sử dụng /analyze_batch để phân tích trang mới.`,
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        console.error('Lỗi khi xử lý câu hỏi:', error);
        bot.sendMessage(
          chatId, 
          `⚠️ *Đã xảy ra lỗi khi xử lý câu hỏi*\n\n${error.message}\n\nVui lòng thử lại hoặc phân tích trang khác.`,
          { parse_mode: 'Markdown' }
        );
      }
    });
  });
  
  // Xử lý khi nhận danh sách URL cho phân tích hàng loạt
  bot.on('message', (msg) => {
    // Bỏ qua các lệnh
    if (msg.text && msg.text.startsWith('/')) return;
    
    // Chỉ xử lý tin nhắn khi người dùng đang chờ gửi danh sách URL
    const chatId = msg.chat.id;
    if (!userStates[chatId] || !userStates[chatId].waitingForBatchUrls) {
      return;
    }
    
    processMessage(msg, async (msg) => {
      const chatId = msg.chat.id;
      const messageText = msg.text;
      
      // Đặt lại trạng thái chờ URL
      userStates[chatId].waitingForBatchUrls = false;
      
      // Kiểm tra xem tin nhắn có chứa danh sách URL không
      const urls = messageText.split('\n').filter(url => url.trim() !== '');
      
      if (urls.length === 0) {
        return bot.sendMessage(chatId, '⚠️ Không tìm thấy URL nào. Vui lòng thử lại với /analyze_batch');
      }
      
      try {
        // Hiển thị thông báo đang xử lý với số lượng URL
        bot.sendMessage(
          chatId, 
          `🔎 *Đang phân tích ${urls.length} URL*\n\nQuá trình này có thể mất vài phút tùy thuộc vào số lượng trang...`,
          { parse_mode: 'Markdown' }
        );
        
        // Lấy prompt hiện tại hoặc sử dụng mặc định
        const currentPrompt = userStates[chatId]?.lastPrompt || 'Tóm tắt nội dung trang này một cách ngắn gọn.';
        
        // Phân tích hàng loạt
        const results = await batchAnalysisService.analyzeBatch(urls, {
          useAi: true,
          customPrompt: currentPrompt
        });
        
        // Gửi thống kê
        bot.sendMessage(
          chatId,
          `📊 *Kết quả phân tích hàng loạt*\n\n` +
          `• Tổng số URL: ${results.totalProcessed}\n` +
          `• Thành công: ${results.successCount}\n` +
          `• Lỗi: ${results.errorCount}\n\n` +
          `💬 Prompt đã sử dụng: "${currentPrompt}"`,
          { parse_mode: 'Markdown' }
        );
        
        // Đợi một chút để tránh giới hạn tốc độ của Telegram
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Gửi kết quả phân tích tổng hợp nếu có
        if (results.combinedAnalysis) {
          // Escape nội dung cho Markdown
          const escapedAnalysis = escapeMarkdown(results.combinedAnalysis);
          const escapedPrompt = escapeMarkdown(currentPrompt);
          
          await bot.sendMessage(
            chatId,
            `🤖 *Phân tích tổng hợp dựa trên prompt*\n\n${escapedAnalysis}\n\n` +
            `✨ *Prompt đã sử dụng:* "${escapedPrompt}"`,
            { parse_mode: 'Markdown' }
          );
          
          // Lưu trang đầu tiên vào trạng thái người dùng để có thể hỏi thêm
          if (results.results.length > 0) {
            userStates[chatId] = {
              ...userStates[chatId],
              pageId: results.results[0].pageId,
              pageTitle: results.results[0].pageTitle,
              content: results.results[0].content,
              lastPrompt: currentPrompt
            };
          }
          
          // Đợi một chút để tránh giới hạn tốc độ của Telegram
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Hỏi người dùng có muốn xem kết quả chi tiết cho từng trang không
          if (results.results.length > 1) {
            await bot.sendMessage(
              chatId,
              '👉 Bạn có muốn xem kết quả chi tiết cho từng trang không? Gửi "Xem chi tiết" để hiển thị hoặc bất kỳ tin nhắn khác để bỏ qua.'
            );
            
            // Lưu trạng thái chờ xem chi tiết
            userStates[chatId].waitingForDetailView = true;
            userStates[chatId].batchResults = results;
            return;
          }
        }
        // Nếu không có kết quả tổng hợp, hiển thị kết quả cho từng URL
        else {
          // Gửi kết quả cho từng URL thành công
          for (const result of results.results) {
            await bot.sendMessage(
              chatId,
              `📝 *${result.pageTitle}*\n` +
              `ID: ${result.pageId}\n\n` +
              `${result.summary}\n\n` +
              `🔗 Xem trang gốc: ${result.url}`,
              { parse_mode: 'MarkdownV2' }
            );
            
            // Đợi một chút giữa các tin nhắn để tránh giới hạn tốc độ của Telegram
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          
          // Lưu trang đầu tiên vào trạng thái người dùng để có thể hỏi thêm
          if (results.results.length > 0) {
            userStates[chatId] = {
              ...userStates[chatId],
              pageId: results.results[0].pageId,
              pageTitle: results.results[0].pageTitle,
              content: results.results[0].content,
              lastPrompt: currentPrompt
            };
          }
        }
        
        // Gửi danh sách lỗi nếu có
        if (results.errors.length > 0) {
          // Giới hạn số lượng lỗi hiển thị để tránh tin nhắn quá dài
          const maxErrorsToShow = 5;
          const errorMessages = results.errors
            .slice(0, maxErrorsToShow)
            .map(err => `- ${err.url || 'URL không xác định'}: ${err.error}`)
            .join('\n');
          
          const additionalErrors = results.errors.length > maxErrorsToShow 
            ? `\n\n...và ${results.errors.length - maxErrorsToShow} lỗi khác` 
            : '';
          
          await bot.sendMessage(
            chatId,
            `⚠️ *Các lỗi phân tích*\n\n${errorMessages}${additionalErrors}\n\nVui lòng kiểm tra lại các URL và thử lại.`,
            { parse_mode: 'Markdown' }
          );
        }
        
        // Gửi thông báo hoàn thành
        if (results.successCount > 0) {
          bot.sendMessage(
            chatId,
            '✅ *Phân tích hoàn tất*\n\nBạn có thể tiếp tục đặt câu hỏi hoặc phân tích trang mới bằng lệnh /analyze_batch',
            { parse_mode: 'Markdown' }
          );
        }
      } catch (error) {
        console.error('Lỗi khi phân tích hàng loạt:', error);
        bot.sendMessage(
          chatId, 
          `⚠️ *Đã xảy ra lỗi khi phân tích*\n\n${error.message}\n\nVui lòng kiểm tra lại các URL và thử lại.`,
          { parse_mode: 'Markdown' }
        );
      }
    });
  });

  console.log('Telegram Bot đã được khởi tạo thành công!');
  return bot;
}

module.exports = {
  initBot
};
