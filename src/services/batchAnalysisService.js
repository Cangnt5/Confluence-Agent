const confluenceService = require('./confluenceService');
const aiService = require('./aiService');
const contentAnalyzer = require('../utils/contentAnalyzer');
const urlParser = require('../utils/urlParser');

/**
 * Service để xử lý phân tích hàng loạt nhiều trang Confluence
 */
class BatchAnalysisService {
  /**
   * Phân tích nhiều URL Confluence cùng lúc
   * @param {Array<string>} urls - Danh sách các URL hoặc ID trang Confluence
   * @param {Object} options - Tùy chọn phân tích
   * @param {boolean} options.useAi - Sử dụng AI để phân tích
   * @param {string} options.customPrompt - Prompt tùy chỉnh cho AI
   * @param {number} options.maxLength - Độ dài tối đa cho tóm tắt (nếu không sử dụng AI)
   * @param {boolean} options.includeImages - Có phân tích hình ảnh hay không
   * @returns {Promise<Array>} - Kết quả phân tích
   */
  async analyzeBatch(urls, options = {}) {
    const { useAi = false, customPrompt = '', maxLength = 500, includeImages = true } = options;
    
    // Chuẩn hóa danh sách URLs (loại bỏ khoảng trắng, trùng lặp)
    const normalizedUrls = this.normalizeUrlList(urls);
    
    // Phân tích từng URL và thu thập kết quả
    const results = [];
    const errors = [];
    const pagesData = [];
    
    // Bước 1: Thu thập dữ liệu từ tất cả các URL
    for (const url of normalizedUrls) {
      try {
        // Trích xuất ID trang từ URL hoặc sử dụng trực tiếp nếu là ID
        const pageId = urlParser.normalizePageInput(url);
        
        if (!pageId) {
          errors.push({ url, error: 'Không thể trích xuất ID trang từ URL' });
          continue;
        }
        
        // Lấy thông tin trang từ Confluence
        const page = await confluenceService.getPageDetails(pageId);
        
        // Trích xuất từ khóa
        const keywords = contentAnalyzer.extractKeywords(page.content, 5);
        
        // Lưu trữ dữ liệu trang
        const pageData = {
          pageId,
          url,
          pageTitle: page.title,
          content: page.content,
          keywords,
          timestamp: new Date().toISOString()
        };
        
        pagesData.push(pageData);
        
        // Tạo tóm tắt riêng cho từng trang
        let summary;
        if (!useAi) {
          // Nếu không sử dụng AI, tạo tóm tắt thông thường
          summary = contentAnalyzer.generateSummary(page.content, parseInt(maxLength));
        } else {
          // Nếu sử dụng AI nhưng không có prompt tùy chỉnh, tạo tóm tắt AI cho từng trang
          if (!customPrompt || customPrompt.trim() === '') {
            summary = await aiService.generateAiSummary(page.content, 'Tóm tắt nội dung trang này một cách ngắn gọn.', includeImages);
          } else {
            // Nếu có prompt tùy chỉnh, để xử lý sau
            summary = 'Sẽ được phân tích trong kết quả tổng hợp';
          }
        }
        
        // Thêm kết quả vào danh sách
        results.push({
          pageId,
          url,
          pageTitle: page.title,
          content: page.content,
          summary,
          keywords,
          method: useAi ? 'ai' : 'rule-based',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error(`Error analyzing ${url}:`, error);
        errors.push({ url, error: error.message });
      }
    }
    
    // Bước 2: Nếu sử dụng AI và có prompt tùy chỉnh, xử lý tất cả các trang cùng lúc
    let combinedAnalysis = null;
    if (useAi && customPrompt && customPrompt.trim() !== '' && pagesData.length > 0) {
      try {
        combinedAnalysis = await aiService.processMultiplePages(pagesData, customPrompt, includeImages);
      } catch (error) {
        console.error('Error in combined analysis:', error);
        combinedAnalysis = `Lỗi khi phân tích kết hợp: ${error.message}`;
      }
    }
    
    return {
      results,
      errors,
      totalProcessed: normalizedUrls.length,
      successCount: results.length,
      errorCount: errors.length,
      combinedAnalysis // Thêm kết quả phân tích kết hợp nếu có
    };
  }
  
  /**
   * Chuẩn hóa danh sách URL
   * @param {Array<string>|string} urls - Danh sách URL hoặc chuỗi URL phân cách bằng dấu xuống dòng
   * @returns {Array<string>} - Danh sách URL đã chuẩn hóa
   */
  normalizeUrlList(urls) {
    // Nếu là chuỗi, tách thành mảng dựa trên dấu xuống dòng hoặc dấu phẩy
    let urlArray = Array.isArray(urls) ? urls : urls.split(/[\n,]+/);
    
    // Loại bỏ khoảng trắng và các mục trống
    urlArray = urlArray
      .map(url => url.trim())
      .filter(url => url.length > 0);
    
    // Loại bỏ các URL trùng lặp
    return [...new Set(urlArray)];
  }
}

module.exports = new BatchAnalysisService();
