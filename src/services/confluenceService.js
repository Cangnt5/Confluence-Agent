const confluenceApi = require('../api/confluenceApi');

/**
 * Service để xử lý logic nghiệp vụ liên quan đến Confluence
 */
class ConfluenceService {
  /**
   * Tìm kiếm thông tin trong Confluence
   * @param {string} query - Từ khóa tìm kiếm
   * @param {number} limit - Số lượng kết quả tối đa
   * @returns {Promise<Array>} - Kết quả tìm kiếm đã được xử lý
   */
  async searchContent(query, limit = 10) {
    try {
      const results = await confluenceApi.searchPages(query, limit);
      
      // Xử lý và định dạng kết quả
      return results.map(page => ({
        id: page.id,
        title: page.title,
        spaceKey: page.space?.key,
        spaceName: page.space?.name,
        lastUpdated: page.history?.lastUpdated,
        url: page._links ? `${page._links.base}${page._links.webui}` : ''
      }));
    } catch (error) {
      console.error('Error in searchContent service:', error);
      throw new Error('Không thể tìm kiếm nội dung: ' + error.message);
    }
  }

  /**
   * Lấy chi tiết trang Confluence
   * @param {string} pageId - ID của trang
   * @returns {Promise<Object>} - Chi tiết trang đã được xử lý
   */
  async getPageDetails(pageId) {
    try {
      const page = await confluenceApi.getPageById(pageId);
      
      // Xử lý và định dạng kết quả
      return {
        id: page.id,
        title: page.title,
        spaceKey: page.space?.key,
        spaceName: page.space?.name,
        version: page.version?.number,
        lastUpdated: page.history?.lastUpdated,
        content: page.body?.storage?.value,
        url: page._links ? `${page._links.base}${page._links.webui}` : ''
      };
    } catch (error) {
      console.error('Error in getPageDetails service:', error);
      throw new Error('Không thể lấy chi tiết trang: ' + error.message);
    }
  }

  /**
   * Lấy danh sách các trang con của một trang
   * @param {string} pageId - ID của trang cha
   * @returns {Promise<Array>} - Danh sách các trang con
   */
  async getPageHierarchy(pageId) {
    try {
      const childPages = await confluenceApi.getChildPages(pageId);
      return childPages.map(page => ({
        id: page.id,
        title: page.title,
        url: `${page._links.base}${page._links.webui}`
      }));
    } catch (error) {
      console.error('Error in getPageHierarchy service:', error);
      throw new Error('Không thể lấy danh sách trang con: ' + error.message);
    }
  }

  /**
   * Tạo hoặc cập nhật trang Confluence
   * @param {Object} pageData - Dữ liệu trang
   * @returns {Promise<Object>} - Thông tin trang đã tạo/cập nhật
   */
  async createOrUpdatePage(pageData) {
    try {
      const { id, title, content, spaceKey, parentId } = pageData;
      
      // Nếu có ID, cập nhật trang hiện có
      if (id) {
        const page = await confluenceApi.getPageById(id);
        const updatedPage = await confluenceApi.updatePage({
          id,
          title,
          content,
          version: page.version.number + 1
        });
        
        return {
          id: updatedPage.id,
          title: updatedPage.title,
          url: `${updatedPage._links.base}${updatedPage._links.webui}`
        };
      }
      
      // Nếu không có ID, tạo trang mới
      const newPage = await confluenceApi.createPage({
        title,
        content,
        spaceKey,
        parentId
      });
      
      return {
        id: newPage.id,
        title: newPage.title,
        url: `${newPage._links.base}${newPage._links.webui}`
      };
    } catch (error) {
      console.error('Error in createOrUpdatePage service:', error);
      throw new Error('Không thể tạo/cập nhật trang: ' + error.message);
    }
  }

  /**
   * Lấy danh sách không gian làm việc
   * @returns {Promise<Array>} - Danh sách không gian làm việc
   */
  async getWorkspaces() {
    try {
      const spaces = await confluenceApi.getSpaces();
      return spaces.map(space => ({
        key: space.key,
        name: space.name,
        description: space.description?.plain?.value,
        url: space._links?.webui
      }));
    } catch (error) {
      console.error('Error in getWorkspaces service:', error);
      throw new Error('Không thể lấy danh sách không gian làm việc: ' + error.message);
    }
  }

  /**
   * Lấy thông tin không gian từ URL hoặc ID trang
   * @param {string} pageIdOrUrl - ID trang hoặc URL Confluence
   * @returns {Promise<Object>} - Thông tin không gian và trang
   */
  async getSpaceInfoFromPage(pageIdOrUrl) {
    try {
      // Nếu là URL, trích xuất ID trang
      let pageId = pageIdOrUrl;
      if (pageIdOrUrl.includes('atlassian.net') || pageIdOrUrl.includes('/wiki/')) {
        const urlPattern = /\/pages\/([0-9]+)/;
        const match = pageIdOrUrl.match(urlPattern);
        if (match && match[1]) {
          pageId = match[1];
        } else {
          throw new Error('Không thể trích xuất ID trang từ URL');
        }
      }
      
      // Lấy thông tin trang
      const page = await this.getPageDetails(pageId);
      
      // Trả về thông tin không gian và trang
      return {
        pageId: page.id,
        pageTitle: page.title,
        spaceKey: page.spaceKey,
        spaceName: page.spaceName
      };
    } catch (error) {
      console.error('Error in getSpaceInfoFromPage service:', error);
      throw new Error('Không thể lấy thông tin không gian từ trang: ' + error.message);
    }
  }
}

module.exports = new ConfluenceService();
