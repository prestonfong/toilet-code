/**
 * Browser Tools Management System for Kilo-Web
 * Handles browser automation, web scraping, and interaction capabilities
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

class BrowserToolsManager {
  static DEFAULT_SETTINGS = {
    browserToolEnabled: true,
    browserViewportSize: '1280x720',
    screenshotQuality: 75,
    remoteBrowserHost: null,
    remoteBrowserEnabled: false,
    headlessMode: true,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    timeout: 30000,
    navigationTimeout: 30000,
    screenshotDirectory: '.kilo/screenshots',
    allowedDomains: [],
    blockedDomains: ['malware.com', 'phishing.site'],
    respectRobotsTxt: true,
    maxConcurrentTabs: 5,
    enableJavaScript: true,
    loadImages: true,
    enableCookies: true,
    clearCacheOnStart: false,
    proxySettings: null,
    downloadDirectory: '.kilo/downloads',
    autoDownloadImages: false,
    maxDownloadSize: 10485760, // 10MB
    sessionTimeout: 3600000, // 1 hour
    enableWebSecurity: true,
    blockAds: true,
    blockTrackers: true
  };

  constructor(workspaceDir = './') {
    this.workspaceDir = workspaceDir;
    this.settings = { ...BrowserToolsManager.DEFAULT_SETTINGS };
    this.browser = null;
    this.pages = new Map();
    this.activePageId = null;
    this.sessionData = new Map();
    this.downloadQueue = [];
    this.stats = {
      pagesOpened: 0,
      screenshotsTaken: 0,
      formsSubmitted: 0,
      downloadsCompleted: 0,
      errorsEncountered: 0,
      sessionStartTime: Date.now()
    };
    this.isInitialized = false;
  }

  /**
   * Initialize the browser tools manager
   */
  async initialize(settings = {}) {
    this.settings = { ...BrowserToolsManager.DEFAULT_SETTINGS, ...settings };
    
    if (!this.settings.browserToolEnabled) {
      console.log('Browser tools disabled in settings');
      return;
    }

    try {
      await this.ensureDirectories();
      await this.initializeBrowser();
      this.startSessionCleanup();
      this.isInitialized = true;
      console.log('✅ Browser Tools Manager initialized');
    } catch (error) {
      console.error('Failed to initialize Browser Tools Manager:', error);
      throw error;
    }
  }

  /**
   * Initialize browser instance
   */
  async initializeBrowser() {
    if (this.settings.remoteBrowserEnabled && this.settings.remoteBrowserHost) {
      await this.connectToRemoteBrowser();
    } else {
      await this.launchLocalBrowser();
    }
  }

  /**
   * Launch local browser instance
   */
  async launchLocalBrowser() {
    // This is a simplified implementation
    // In production, you would use puppeteer or playwright
    console.log('🌐 Launching local browser instance...');
    
    const browserOptions = {
      headless: this.settings.headlessMode,
      viewport: this.parseViewportSize(this.settings.browserViewportSize),
      userAgent: this.settings.userAgent,
      timeout: this.settings.timeout,
      javascript: this.settings.enableJavaScript,
      loadImages: this.settings.loadImages
    };

    // Simulated browser instance
    this.browser = {
      isConnected: true,
      options: browserOptions,
      pages: new Map(),
      newPage: async () => this.createNewPage(),
      close: async () => this.closeBrowser()
    };

    console.log('Browser launched successfully');
  }

  /**
   * Connect to remote browser
   */
  async connectToRemoteBrowser() {
    console.log(`🔗 Connecting to remote browser at ${this.settings.remoteBrowserHost}...`);
    
    // In production, implement actual remote browser connection
    this.browser = {
      isConnected: true,
      isRemote: true,
      host: this.settings.remoteBrowserHost,
      pages: new Map(),
      newPage: async () => this.createNewPage(),
      close: async () => this.closeBrowser()
    };

    console.log('Connected to remote browser successfully');
  }

  /**
   * Create a new browser page/tab
   */
  async createNewPage() {
    if (!this.isInitialized || !this.browser?.isConnected) {
      throw new Error('Browser not initialized or not connected');
    }

    if (this.pages.size >= this.settings.maxConcurrentTabs) {
      throw new Error(`Maximum concurrent tabs (${this.settings.maxConcurrentTabs}) reached`);
    }

    const pageId = this.generatePageId();
    const page = {
      id: pageId,
      url: null,
      title: null,
      content: null,
      cookies: [],
      localStorage: {},
      sessionStorage: {},
      screenshots: [],
      interactions: [],
      created: Date.now(),
      lastActivity: Date.now()
    };

    this.pages.set(pageId, page);
    this.activePageId = pageId;
    this.stats.pagesOpened++;

    return page;
  }

  /**
   * Navigate to a URL
   */
  async navigateTo(url, options = {}) {
    await this.validateAndCleanUrl(url);
    
    const page = await this.getActivePage();
    const startTime = Date.now();

    try {
      // Simulate navigation
      console.log(`🔄 Navigating to: ${url}`);
      
      // In production, use actual browser navigation
      page.url = url;
      page.title = `Page Title for ${url}`;
      page.lastActivity = Date.now();
      
      // Add to interaction history
      page.interactions.push({
        type: 'navigation',
        url,
        timestamp: Date.now(),
        duration: Date.now() - startTime
      });

      return {
        success: true,
        url: page.url,
        title: page.title,
        loadTime: Date.now() - startTime
      };

    } catch (error) {
      this.stats.errorsEncountered++;
      console.error('Navigation failed:', error);
      throw error;
    }
  }

  /**
   * Take a screenshot
   */
  async takeScreenshot(options = {}) {
    const page = await this.getActivePage();
    const timestamp = Date.now();
    const filename = options.filename || `screenshot_${timestamp}.png`;
    const fullPath = path.join(this.workspaceDir, this.settings.screenshotDirectory, filename);

    try {
      // Simulate screenshot capture
      const screenshotData = {
        filename,
        path: fullPath,
        url: page.url,
        timestamp,
        quality: options.quality || this.settings.screenshotQuality,
        dimensions: this.parseViewportSize(this.settings.browserViewportSize)
      };

      // In production, capture actual screenshot
      await this.saveScreenshotData(screenshotData);
      
      page.screenshots.push(screenshotData);
      this.stats.screenshotsTaken++;

      console.log(`📸 Screenshot saved: ${filename}`);
      return screenshotData;

    } catch (error) {
      this.stats.errorsEncountered++;
      console.error('Screenshot failed:', error);
      throw error;
    }
  }

  /**
   * Extract text content from page
   */
  async extractText(selector = null) {
    const page = await this.getActivePage();

    try {
      // Simulate text extraction
      let extractedText = '';
      
      if (selector) {
        extractedText = `Text content from selector: ${selector} on ${page.url}`;
      } else {
        extractedText = `Full page text content from ${page.url}`;
      }

      page.interactions.push({
        type: 'text_extraction',
        selector,
        timestamp: Date.now(),
        length: extractedText.length
      });

      return {
        text: extractedText,
        selector,
        url: page.url,
        timestamp: Date.now()
      };

    } catch (error) {
      this.stats.errorsEncountered++;
      console.error('Text extraction failed:', error);
      throw error;
    }
  }

  /**
   * Click an element
   */
  async clickElement(selector, options = {}) {
    const page = await this.getActivePage();

    try {
      // Simulate click
      console.log(`👆 Clicking element: ${selector}`);
      
      page.interactions.push({
        type: 'click',
        selector,
        timestamp: Date.now(),
        coordinates: options.coordinates || null
      });

      return {
        success: true,
        selector,
        timestamp: Date.now()
      };

    } catch (error) {
      this.stats.errorsEncountered++;
      console.error('Click failed:', error);
      throw error;
    }
  }

  /**
   * Fill form field
   */
  async fillForm(formData) {
    const page = await this.getActivePage();

    try {
      console.log(`📝 Filling form on: ${page.url}`);
      
      for (const [selector, value] of Object.entries(formData)) {
        // Simulate form filling
        page.interactions.push({
          type: 'form_fill',
          selector,
          value: typeof value === 'string' ? value.substring(0, 50) + '...' : '[complex_value]',
          timestamp: Date.now()
        });
      }

      return {
        success: true,
        fieldsCount: Object.keys(formData).length,
        timestamp: Date.now()
      };

    } catch (error) {
      this.stats.errorsEncountered++;
      console.error('Form filling failed:', error);
      throw error;
    }
  }

  /**
   * Submit form
   */
  async submitForm(selector = 'form') {
    const page = await this.getActivePage();

    try {
      console.log(`📤 Submitting form: ${selector}`);
      
      page.interactions.push({
        type: 'form_submit',
        selector,
        timestamp: Date.now()
      });

      this.stats.formsSubmitted++;

      return {
        success: true,
        selector,
        timestamp: Date.now()
      };

    } catch (error) {
      this.stats.errorsEncountered++;
      console.error('Form submission failed:', error);
      throw error;
    }
  }

  /**
   * Wait for element
   */
  async waitForElement(selector, options = {}) {
    const timeout = options.timeout || this.settings.timeout;
    const startTime = Date.now();

    try {
      // Simulate waiting
      console.log(`⏳ Waiting for element: ${selector}`);
      
      // In production, implement actual waiting logic
      await new Promise(resolve => setTimeout(resolve, 1000));

      const page = await this.getActivePage();
      page.interactions.push({
        type: 'wait_element',
        selector,
        timestamp: Date.now(),
        waitTime: Date.now() - startTime
      });

      return {
        found: true,
        selector,
        waitTime: Date.now() - startTime
      };

    } catch (error) {
      this.stats.errorsEncountered++;
      console.error('Wait for element failed:', error);
      throw error;
    }
  }

  /**
   * Execute JavaScript on page
   */
  async executeScript(script, args = []) {
    if (!this.settings.enableJavaScript) {
      throw new Error('JavaScript execution is disabled');
    }

    const page = await this.getActivePage();

    try {
      console.log(`🔧 Executing script on: ${page.url}`);
      
      // Simulate script execution
      const result = `Script result for: ${script.substring(0, 50)}...`;
      
      page.interactions.push({
        type: 'script_execution',
        script: script.substring(0, 100) + '...',
        timestamp: Date.now()
      });

      return {
        result,
        timestamp: Date.now()
      };

    } catch (error) {
      this.stats.errorsEncountered++;
      console.error('Script execution failed:', error);
      throw error;
    }
  }

  /**
   * Get page cookies
   */
  async getCookies() {
    if (!this.settings.enableCookies) {
      return [];
    }

    const page = await this.getActivePage();
    return page.cookies || [];
  }

  /**
   * Set page cookies
   */
  async setCookies(cookies) {
    if (!this.settings.enableCookies) {
      throw new Error('Cookies are disabled');
    }

    const page = await this.getActivePage();
    page.cookies = cookies;

    page.interactions.push({
      type: 'set_cookies',
      count: cookies.length,
      timestamp: Date.now()
    });

    return { success: true, count: cookies.length };
  }

  /**
   * Download file
   */
  async downloadFile(url, options = {}) {
    const filename = options.filename || this.extractFilenameFromUrl(url);
    const downloadPath = path.join(this.workspaceDir, this.settings.downloadDirectory, filename);

    try {
      console.log(`📥 Downloading file: ${url}`);
      
      // Simulate download
      const downloadInfo = {
        url,
        filename,
        path: downloadPath,
        size: Math.floor(Math.random() * 1000000), // Simulated size
        timestamp: Date.now(),
        status: 'completed'
      };

      this.downloadQueue.push(downloadInfo);
      this.stats.downloadsCompleted++;

      return downloadInfo;

    } catch (error) {
      this.stats.errorsEncountered++;
      console.error('Download failed:', error);
      throw error;
    }
  }

  /**
   * Get page source
   */
  async getPageSource() {
    const page = await this.getActivePage();
    
    // Simulate getting page source
    const pageSource = `<!DOCTYPE html><html><head><title>${page.title}</title></head><body>Simulated page content for ${page.url}</body></html>`;
    
    return {
      source: pageSource,
      url: page.url,
      timestamp: Date.now()
    };
  }

  /**
   * Close current page
   */
  async closePage(pageId = null) {
    const targetPageId = pageId || this.activePageId;
    
    if (!this.pages.has(targetPageId)) {
      throw new Error(`Page ${targetPageId} not found`);
    }

    this.pages.delete(targetPageId);
    
    if (this.activePageId === targetPageId) {
      // Set another page as active if available
      const remainingPages = Array.from(this.pages.keys());
      this.activePageId = remainingPages.length > 0 ? remainingPages[0] : null;
    }

    console.log(`🗂️ Closed page: ${targetPageId}`);
    return { success: true, pageId: targetPageId };
  }

  /**
   * Get active page
   */
  async getActivePage() {
    if (!this.activePageId || !this.pages.has(this.activePageId)) {
      // Create new page if none exists
      return await this.createNewPage();
    }

    const page = this.pages.get(this.activePageId);
    page.lastActivity = Date.now();
    return page;
  }

  /**
   * Switch to page
   */
  async switchToPage(pageId) {
    if (!this.pages.has(pageId)) {
      throw new Error(`Page ${pageId} not found`);
    }

    this.activePageId = pageId;
    const page = this.pages.get(pageId);
    page.lastActivity = Date.now();

    return { success: true, pageId, url: page.url };
  }

  /**
   * List all pages
   */
  listPages() {
    return Array.from(this.pages.values()).map(page => ({
      id: page.id,
      url: page.url,
      title: page.title,
      created: page.created,
      lastActivity: page.lastActivity,
      interactionCount: page.interactions.length,
      screenshotCount: page.screenshots.length,
      isActive: page.id === this.activePageId
    }));
  }

  /**
   * Get browser statistics
   */
  getStats() {
    return {
      ...this.stats,
      activePagesCount: this.pages.size,
      totalSessionTime: Date.now() - this.stats.sessionStartTime,
      averagePageLifetime: this.calculateAveragePageLifetime(),
      downloadQueueSize: this.downloadQueue.length
    };
  }

  /**
   * Validate and clean URL
   */
  async validateAndCleanUrl(url) {
    // Check allowed/blocked domains
    const hostname = new URL(url).hostname;
    
    if (this.settings.blockedDomains.includes(hostname)) {
      throw new Error(`Domain ${hostname} is blocked`);
    }

    if (this.settings.allowedDomains.length > 0 && !this.settings.allowedDomains.includes(hostname)) {
      throw new Error(`Domain ${hostname} is not in allowed list`);
    }

    // Check robots.txt if enabled
    if (this.settings.respectRobotsTxt) {
      await this.checkRobotsTxt(url);
    }

    return true;
  }

  /**
   * Check robots.txt compliance
   */
  async checkRobotsTxt(url) {
    try {
      const robotsUrl = new URL('/robots.txt', url).href;
      // In production, fetch and parse robots.txt
      console.log(`Checking robots.txt: ${robotsUrl}`);
      return true;
    } catch (error) {
      console.warn('Failed to check robots.txt:', error.message);
      return true; // Allow if can't check
    }
  }

  /**
   * Utility methods
   */
  parseViewportSize(viewportString) {
    const [width, height] = viewportString.split('x').map(Number);
    return { width, height };
  }

  generatePageId() {
    return `page_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  extractFilenameFromUrl(url) {
    try {
      const urlPath = new URL(url).pathname;
      const filename = path.basename(urlPath);
      return filename || `download_${Date.now()}`;
    } catch (error) {
      return `download_${Date.now()}`;
    }
  }

  calculateAveragePageLifetime() {
    if (this.pages.size === 0) return 0;
    
    const totalLifetime = Array.from(this.pages.values())
      .reduce((sum, page) => sum + (page.lastActivity - page.created), 0);
    
    return totalLifetime / this.pages.size;
  }

  async ensureDirectories() {
    const directories = [
      this.settings.screenshotDirectory,
      this.settings.downloadDirectory
    ];

    for (const dir of directories) {
      const fullPath = path.join(this.workspaceDir, dir);
      await fs.mkdir(fullPath, { recursive: true });
    }
  }

  async saveScreenshotData(screenshotData) {
    // In production, save actual screenshot file
    await fs.writeFile(screenshotData.path, `Simulated screenshot data for ${screenshotData.url}`);
  }

  startSessionCleanup() {
    // Clean up inactive pages periodically
    setInterval(() => {
      const cutoff = Date.now() - this.settings.sessionTimeout;
      const inactivePages = [];

      for (const [pageId, page] of this.pages) {
        if (page.lastActivity < cutoff && pageId !== this.activePageId) {
          inactivePages.push(pageId);
        }
      }

      inactivePages.forEach(pageId => this.closePage(pageId));
      
      if (inactivePages.length > 0) {
        console.log(`🧹 Cleaned up ${inactivePages.length} inactive pages`);
      }
    }, 300000); // Check every 5 minutes
  }

  /**
   * Close browser and cleanup
   */
  async closeBrowser() {
    if (this.browser?.isConnected) {
      console.log('🔒 Closing browser...');
      this.browser.isConnected = false;
      this.browser = null;
    }

    this.pages.clear();
    this.activePageId = null;
    this.isInitialized = false;
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    await this.closeBrowser();
    this.downloadQueue.length = 0;
    this.sessionData.clear();
    console.log('Browser Tools Manager cleaned up');
  }
}

module.exports = BrowserToolsManager;