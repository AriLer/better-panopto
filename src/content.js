// ==========================================
// 1. Initial Page Scanning & Background Setup
// ==========================================
import './styleOverride.css'

const TARGET_DIV_ID = 'viewerContent'

// Check if the target layout wrapper is already present on load
function checkForElement() {
  const targetDiv = document.getElementById(TARGET_DIV_ID)
  if (targetDiv) {
    performBackgroundAction(targetDiv)
    return true
  }
  return false
}

// Fallback: Observe DOM changes if content loads dynamically via JS
if (!checkForElement()) {
  const observer = new MutationObserver((mutations, obs) => {
    if (document.getElementById(TARGET_DIV_ID)) {
      const targetDiv = document.getElementById(TARGET_DIV_ID)
      performBackgroundAction(targetDiv)
      obs.disconnect() // Stop observing once found and acted upon
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
    (response) => {
      // Background action response handler
    },
  )
}

// ==========================================
// 2. Extension Core Layout & Resizer Init
// ==========================================

function initExtension() {
  const viewerContent = document.getElementById('viewerContent')
  const leftPane = document.getElementById('leftPane')

  if (!viewerContent || !leftPane) return

  // Prevent applying resizer if the left pane has been moved into the main component wrapper
  const isMainComponentChild = leftPane.closest('#mainComponent') !== null
  const existingResizer = document.getElementById('custom-resizer-handle')
  const existingStyles = document.getElementById('custom-resizer-styles')

  if (isMainComponentChild) {
    if (existingResizer) existingResizer.remove()
    if (existingStyles) existingStyles.remove()
    return
  }

  if (existingResizer) return

  // --- Create the Interactive Resizing Divider Handle ---
  const resizer = document.createElement('div')
  resizer.id = 'custom-resizer-handle'

  Object.assign(resizer.style, {
    width: '6px',
    cursor: 'col-resize',
    backgroundColor: '#ccc',
    height: '100%',
    position: 'absolute',
    top: '0',
    right: '0',
    zIndex: '9999',
    userSelect: 'none',
    transition: 'background-color 0.2s',
  })

  resizer.addEventListener(
    'mouseenter',
    () => (resizer.style.backgroundColor = '#2196F3'),
  )
  resizer.addEventListener(
    'mouseleave',
    () => (resizer.style.backgroundColor = '#ccc'),
  )

  if (getComputedStyle(leftPane).position === 'static') {
    leftPane.style.position = 'relative'
  }
  leftPane.appendChild(resizer)

  // --- Inject Layout & Stream Styling Overrides ---
  // const styleOverride = document.createElement('style')
  // styleOverride.id = 'custom-resizer-styles'
  // styleOverride.innerHTML = `
  //   /* Main Layout Flex Container Setup */
  //   #viewerContent {
  //     display: flex !important;
  //     flex-direction: row !important;
  //     width: 100% !important;
  //     box-sizing: border-box !important;
  //   }

  //   /* Left Sidebar Panel Sizing & Variable Binding */
  //   #leftPane {
  //     flex: 0 0 auto !important;
  //     max-width: none !important;
  //     width: var(--left-pane-width, 460px) !important;
  //   }

  //   #leftPlayerContainer {
  //     position: relative;
  //   }

  //   #leftPane #leftPlayerContainer,
  //   #leftPane #primaryPlayer,
  //   #leftPane #primaryScreen:not(.roaming),
  //   #leftPane #eventTabPanes,
  //   #leftPane #searchTabPane,
  //   #leftPane #contentsTabPane {
  //     width: var(--left-pane-width, 460px) !important;
  //   }

  //   /* Right Main Content Area Flex Growth & Stream Layouts */
  //   #viewerContent > main {
  //     flex: 1 1 0% !important;
  //     min-width: 0 !important;
  //     width: auto !important;
  //     max-width: none !important;
  //     position: relative !important;
  //     left: auto !important;
  //     right: auto !important;
  //   }

  //   #rightPlayersContainer {
  //     position: relative !important;
  //     width: 100% !important;
  //   }

  //   #primaryScreen {
  //     width: 100% !important;
  //     height: 100% !important;
  //     top: 0 !important;
  //     left: 0 !important;
  //     margin: 0 !important;
  //     position: relative !important;
  //   }

  //   #primaryPlayer {
  //     position: absolute !important;
  //     height: 100% !important;
  //     width: 100% !important;
  //   }

  //   /* Roaming Mode Adjustments for Primary Player/Screen */
  //   #primaryPlayer.roaming {
  //     left: 0 !important;
  //     top: 0 !important;
  //     height: 30% !important;
  //     width: 100% !important;
  //   }

  //   /* Secondary Stream & Content Containers */
  //   #secondaryScreen {
  //     width: 100% !important;
  //     height: 100% !important;
  //     left: 0 !important;
  //     top: 0 !important;
  //     margin: 0 !important;
  //   }

  //   .secondary-content.object-video {
  //     position: absolute !important;
  //     width: 100% !important;
  //     height: 100% !important;
  //   }

  //   #viewerContent > main .secondaryPlayer:not(.roaming) {
  //     position: relative !important;
  //     height: 100% !important;
  //     width: 100% !important;
  //   }

  //   #viewerContent > main .secondaryPlayer.roaming {
  //     width: 100% !important;
  //     top: 0 !important;
  //     height: 100% !important;
  //     position: relative !important;
  //   }

  //   #thumbnailList {
  //     width: 100% !important;
  //   }
  // `
  // document.head.appendChild(styleOverride)

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

    const minWidth = 200
    const maxWidth = window.innerWidth * 0.5 // Capped at a maximum of 50% screen width

    if (newWidth < minWidth) newWidth = minWidth
    if (newWidth > maxWidth) newWidth = maxWidth

    // Dynamically update CSS variable to scale both pane and main container simultaneously
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

  // Use event delegation on the document to capture dynamically rendered hover buttons
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
    true, // Capture phase to intercept click before native handlers execute
  )
}

// Safely swap two elements in place within the DOM tree
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
