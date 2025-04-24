/**
 * Tiện ích xử lý nội dung HTML từ Confluence
 */

/**
 * Chuyển đổi nội dung HTML của Confluence thành văn bản thuần túy
 * @param {string} html - Nội dung HTML từ Confluence
 * @returns {string} - Văn bản thuần túy
 */
function htmlToPlainText(html) {
  if (!html) return '';
  
  // Loại bỏ tất cả các thẻ HTML
  let text = html.replace(/<[^>]*>/g, ' ');
  
  // Thay thế các ký tự đặc biệt HTML
  text = text.replace(/&nbsp;/g, ' ')
             .replace(/&amp;/g, '&')
             .replace(/&lt;/g, '<')
             .replace(/&gt;/g, '>')
             .replace(/&quot;/g, '"')
             .replace(/&#39;/g, "'");
  
  // Loại bỏ khoảng trắng thừa
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

/**
 * Trích xuất các tiêu đề từ nội dung HTML
 * @param {string} html - Nội dung HTML từ Confluence
 * @returns {Array} - Mảng các tiêu đề và cấp độ của chúng
 */
function extractHeadings(html) {
  if (!html) return [];
  
  const headings = [];
  const headingRegex = /<h([1-6])[^>]*>(.*?)<\/h\1>/g;
  let match;
  
  while ((match = headingRegex.exec(html)) !== null) {
    const level = parseInt(match[1]);
    const text = htmlToPlainText(match[2]);
    
    headings.push({
      level,
      text
    });
  }
  
  return headings;
}

/**
 * Trích xuất các liên kết từ nội dung HTML
 * @param {string} html - Nội dung HTML từ Confluence
 * @returns {Array} - Mảng các liên kết và văn bản của chúng
 */
function extractLinks(html) {
  if (!html) return [];
  
  const links = [];
  const linkRegex = /<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g;
  let match;
  
  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];
    const text = htmlToPlainText(match[2]);
    
    links.push({
      url,
      text
    });
  }
  
  return links;
}

/**
 * Tạo nội dung HTML đơn giản cho Confluence
 * @param {string} content - Nội dung văn bản
 * @returns {string} - Nội dung HTML định dạng cho Confluence
 */
function createConfluenceHtml(content) {
  if (!content) return '';
  
  // Xử lý xuống dòng
  const paragraphs = content.split('\n\n');
  
  // Tạo các thẻ p cho mỗi đoạn văn
  const htmlParagraphs = paragraphs.map(paragraph => {
    // Bỏ qua đoạn trống
    if (!paragraph.trim()) return '';
    
    // Xử lý các dòng trong đoạn văn
    const lines = paragraph.split('\n');
    const processedLines = lines.map(line => line.trim()).join('<br>');
    
    return `<p>${processedLines}</p>`;
  });
  
  return htmlParagraphs.join('');
}

module.exports = {
  htmlToPlainText,
  extractHeadings,
  extractLinks,
  createConfluenceHtml
};
