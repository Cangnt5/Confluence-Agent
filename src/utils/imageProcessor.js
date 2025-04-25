/**
 * Tiện ích xử lý hình ảnh từ Confluence
 */
const axios = require('axios');
const config = require('../config/config');

/**
 * Trích xuất URL hình ảnh từ nội dung HTML
 * @param {string} html - Nội dung HTML từ Confluence
 * @returns {Array} - Mảng các URL hình ảnh
 */
function extractImageUrls(html) {
  if (!html) return [];
  
  const images = [];
  const imgRegex = /<img[^>]+src="([^">]+)"[^>]*>/g;
  let match;
  
  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1];
    // Kiểm tra xem URL có phải là URL tương đối không
    if (src.startsWith('/')) {
      // Nếu là URL tương đối, thêm baseURL vào
      images.push(`${config.confluenceBaseUrl}${src}`);
    } else {
      // Nếu là URL đầy đủ, sử dụng trực tiếp
      images.push(src);
    }
  }
  
  return images;
}

/**
 * Tải hình ảnh và chuyển đổi sang base64
 * @param {string} url - URL của hình ảnh
 * @returns {Promise<string>} - Chuỗi base64 của hình ảnh
 */
async function downloadImageAsBase64(url) {
  try {
    const response = await axios.get(url, { 
      responseType: 'arraybuffer',
      auth: {
        username: config.confluenceUsername,
        password: config.confluenceApiToken
      }
    });
    const base64 = Buffer.from(response.data).toString('base64');
    const contentType = response.headers['content-type'];
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.error('Error downloading image:', error.message);
    return null;
  }
}

/**
 * Tải nhiều hình ảnh và chuyển đổi sang base64
 * @param {Array} urls - Mảng các URL hình ảnh
 * @param {number} maxImages - Số lượng hình ảnh tối đa cần xử lý
 * @returns {Promise<Array>} - Mảng các chuỗi base64 của hình ảnh
 */
async function processImages(urls, maxImages = 5) {
  if (!urls || urls.length === 0) return [];
  
  // Giới hạn số lượng hình ảnh để tránh quá tải
  const limitedUrls = urls.slice(0, maxImages);
  
  try {
    const imagePromises = limitedUrls.map(url => downloadImageAsBase64(url));
    const results = await Promise.allSettled(imagePromises);
    
    // Lọc ra các hình ảnh đã tải thành công
    return results
      .filter(result => result.status === 'fulfilled' && result.value)
      .map(result => result.value);
  } catch (error) {
    console.error('Error processing images:', error);
    return [];
  }
}

module.exports = {
  extractImageUrls,
  downloadImageAsBase64,
  processImages
};
