/**
 * Tiện ích để xử lý và phân tích URL Confluence
 */

/**
 * Trích xuất ID trang từ URL Confluence
 * @param {string} url - URL Confluence
 * @returns {string|null} - ID trang hoặc null nếu không tìm thấy
 */
function extractPageIdFromUrl(url) {
  try {
    // In ra URL để debug
    console.log('Extracting page ID from URL:', url);
    
    // Mẫu regex để tìm ID trang trong URL Confluence
    // Hỗ trợ nhiều định dạng URL Confluence khác nhau
    const patterns = [
      /\/pages\/([0-9]+)/, // Định dạng chuẩn: /spaces/SPACE/pages/123456
      /pageId=([0-9]+)/, // Định dạng query param: ?pageId=123456
      /\/([0-9]+)\.html/, // Định dạng cũ: /123456.html
      /\/pages\/([0-9]+)\//, // Định dạng với tiền tố và hậu tố: /pages/123456/App+driver
      /\/([0-9]+)\//, // Định dạng số đơn giản với dấu gạch chéo: /123456/
      /\/pages\/([0-9]+)$/, // Định dạng kết thúc bằng ID: /pages/123456
      /\/([0-9]+)$/, // Định dạng kết thúc bằng số: /123456
      /\/pages\/([0-9]+)\?/, // Định dạng với query string: /pages/123456?...
      /\/pages\/([0-9]+)\//i, // Định dạng với bất kỳ ký tự nào sau ID
      /\/([0-9]+)\?/ // Định dạng số đơn giản với query string: /123456?...
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        console.log('Found page ID:', match[1], 'using pattern:', pattern);
        return match[1];
      }
    }

    return null;
  } catch (error) {
    console.error('Error extracting page ID from URL:', error);
    return null;
  }
}

/**
 * Kiểm tra xem một chuỗi có phải là URL Confluence hay không
 * @param {string} input - Chuỗi đầu vào
 * @returns {boolean} - true nếu là URL Confluence, false nếu không phải
 */
function isConfluenceUrl(input) {
  return input.includes('atlassian.net') || 
         input.includes('confluence.com') || 
         input.includes('/wiki/') ||
         input.includes('/display/') ||
         input.includes('giaohangnhanh');
}

/**
 * Chuẩn hóa đầu vào thành ID trang
 * @param {string} input - URL hoặc ID trang
 * @returns {string|null} - ID trang hoặc null nếu không thể xác định
 */
function normalizePageInput(input) {
  if (!input) return null;
  
  input = input.trim();
  
  // Nếu đầu vào là URL
  if (isConfluenceUrl(input)) {
    return extractPageIdFromUrl(input);
  }
  
  // Nếu đầu vào là số (ID trang)
  if (/^[0-9]+$/.test(input)) {
    return input;
  }
  
  return null;
}

module.exports = {
  extractPageIdFromUrl,
  isConfluenceUrl,
  normalizePageInput
};
