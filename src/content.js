import './styleOverride.css'

// ==========================================
// 1. Initial Page Scanning & Background Setup
// ==========================================

const TARGET_DIV_ID = 'viewerContent'

function checkForElement() {
  const targetDiv = document.getElementById(TARGET_DIV_ID)
  if (targetDiv) {
    performBackgroundAction(targetDiv)
    return true
  }
  return false
}

if (!checkForElement()) {
  const observer = new MutationObserver((mutations, obs) => {
    if (document.getElementById(TARGET_DIV_ID)) {
      const targetDiv = document.getElementById(TARGET_DIV_ID)
      performBackgroundAction(targetDiv)
      obs.disconnect()
    }
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  })
}

function performBackgroundAction(divElement) {
  const contentToShare = divElement.innerText
  chrome.runtime.sendMessage(
    {
      action: 'DIV_FOUND',
      data: contentToShare,
    },
    (response) => {},
  )
}

// ==========================================
// 2. Extension Core Layout & Resizer Init
// ==========================================

function initExtension() {
  const viewerContent = document.getElementById('viewerContent')
  // const minWidth = window.innerWidth * 0.2
  const leftPane = document.getElementById('leftPane')

  if (!viewerContent || !leftPane) return

  // Check if target elements exist
  // Check if target elements exist
  const secondaryContent = document.querySelector('.secondaryContent')
  const leftPlayerContainer = document.getElementById('leftPlayerContainer')

  if (secondaryContent && leftPlayerContainer) {
    // Use a dataset attribute flag to ensure this swap happens ONLY ONCE permanently
    if (
      leftPlayerContainer.dataset.swapped !== 'true' &&
      secondaryContent.children.length === 0
    ) {
      leftPlayerContainer.dataset.swapped = 'true' // Mark as swapped so it never loops again

      swapElements(leftPlayerContainer, secondaryContent)

      const newWidth = `${window.innerWidth * 0.2}px`
      viewerContent.style.setProperty('--left-pane-width', newWidth)
      leftPane.style.width = newWidth
      // --------------------------------------------------

      window.dispatchEvent(new Event('resize'))
    }
  }

  const isMainComponentChild = leftPane.closest('#mainComponent') !== null
  const existingResizer = document.getElementById('custom-resizer-handle')

  if (isMainComponentChild) {
    if (existingResizer) existingResizer.remove()
    return
  }

  if (existingResizer) return

  // --- Dynamically sync video aspect ratio to CSS variable ---
  const videoEl =
    document.getElementById('primaryVideo') || document.querySelector('video')
  if (videoEl) {
    const updateVideoRatio = () => {
      if (videoEl.videoWidth && videoEl.videoHeight) {
        const ratio = videoEl.videoHeight / videoEl.videoWidth
        viewerContent.style.setProperty('--video-ratio', ratio)
      }
    }
    videoEl.addEventListener('loadedmetadata', updateVideoRatio)
    updateVideoRatio()
  }

  // --- Create the Interactive Resizing Divider Handle ---
  const resizer = document.createElement('div')
  resizer.id = 'custom-resizer-handle'

  Object.assign(resizer.style, {
    width: '6px',
    cursor: 'col-resize',
    backgroundColor: '#b2b5bc',
    height: '100%',
    position: 'absolute',
    top: '0',
    right: '-1rem',
    zIndex: '9999',
    borderRadius: '5px',
    userSelect: 'none',
    transition: 'background-color 0.2s',
  })

  resizer.addEventListener(
    'mouseenter',
    () => (resizer.style.backgroundColor = '#8a9dad'),
  )
  resizer.addEventListener(
    'mouseleave',
    () => (resizer.style.backgroundColor = '#ccc'),
  )

  if (getComputedStyle(leftPane).position === 'static') {
    leftPane.style.position = 'relative'
  }
  leftPane.appendChild(resizer)

  // Strip conflicting inline constraints injected by native scripts on the main container
  function neutralizeMainElement() {
    const mainEl = viewerContent.querySelector('main')
    if (mainEl) {
      mainEl.style.width = ''
      mainEl.style.left = ''
      mainEl.style.position = 'relative'
    }
  }

  neutralizeMainElement()

  // --- Mouse Drag Mechanics for Resizing ---
  let isDragging = false

  resizer.addEventListener('mousedown', (e) => {
    isDragging = true
    document.body.style.cursor = 'col-resize'
    e.preventDefault()
  })

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return

    const leftPaneRect = leftPane.getBoundingClientRect()
    let newWidth = e.clientX - leftPaneRect.left

    const minWidth = window.innerWidth * 0.2
    const maxWidth = window.innerWidth * 0.5 // Capped at a maximum of 50% screen width

    if (newWidth < minWidth) newWidth = minWidth
    if (newWidth > maxWidth) newWidth = maxWidth

    // Dynamically update CSS variable to scale pane, player height, and main container simultaneously
    viewerContent.style.setProperty('--left-pane-width', `${newWidth}px`)
    leftPane.style.width = `${newWidth}px`

    neutralizeMainElement()
  })

  window.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false
      document.body.style.cursor = 'default'
    }
  })

  setupSwapButtonListener()
}

// ==========================================
// 3. Stream Swapping & Event Delegation
// ==========================================

let swapListenerInitialized = false

function setupSwapButtonListener() {
  if (swapListenerInitialized) return
  swapListenerInitialized = true

  document.addEventListener(
    'click',
    (event) => {
      const swapBtn = event.target.closest('.swap-streams-button')
      if (!swapBtn) return

      const primaryScreen = document.getElementById('primaryScreen')
      const secondaryScreen = document.getElementById('secondaryScreen')

      if (primaryScreen && secondaryScreen) {
        swapElements(primaryScreen, secondaryScreen)
      }
    },
    true,
  )
}

function swapElements(node1, node2) {
  const afterNode2 = node2.nextElementSibling
  const parent2 = node2.parentNode
  node1.replaceWith(node2)
  parent2.insertBefore(node1, afterNode2)
}

// ==========================================
// 4. Global Observer & Lifecycle Hooks
// ==========================================

const globalObserver = new MutationObserver(() => {
  initExtension()
})

globalObserver.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
})
if (
  document.readyState === 'complete' ||
  document.readyState === 'interactive'
) {
  initExtension()
} else {
  window.addEventListener('DOMContentLoaded', initExtension)
}
