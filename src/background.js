chrome.runtime.onInstalled.addListener(() => {
  console.log('Headless background service worker running.')
})

// Listen for messages sent from the content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'DIV_FOUND') {
    console.log('Data received from content script:', message.data)

    // Do further behind-the-scenes processing here (e.g., save to chrome.storage)
    chrome.storage.local.set({ lastScrapedData: message.data }, () => {
      console.log('Data saved securely in extension storage.')
    })

    sendResponse({ status: 'success' })
  }
})
