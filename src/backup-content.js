// The ID of the div you are looking for
const TARGET_DIV_ID = 'viewerContent'

// 1. Check if the element is already present on load
function checkForElement() {
  const targetDiv = document.getElementById(TARGET_DIV_ID)

  if (targetDiv) {
    console.log('Found the target div!', targetDiv)

    // Do your behind-the-scenes work here
    // e.g., extract text, modify attributes, or send data to background.js
    performBackgroundAction(targetDiv)

    return true
  }
  return false
}

// Run immediately once the script injects
if (!checkForElement()) {
  // 2. Fallback: If the site loads content dynamically via JS, observe DOM changes
  const observer = new MutationObserver((mutations, obs) => {
    if (document.getElementById(TARGET_DIV_ID)) {
      console.log('Found the target div via MutationObserver!')
      const targetDiv = document.getElementById(TARGET_DIV_ID)

      performBackgroundAction(targetDiv)

      // Stop observing once found so it only activates "once"
      obs.disconnect()
    }
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  })
}

function performBackgroundAction(divElement) {
  // Example action: Read data from the div and message the background script
  const contentToShare = divElement.innerText

  chrome.runtime.sendMessage(
    {
      action: 'DIV_FOUND',
      data: contentToShare,
    },
    (response) => {
      console.log('Background response:', response)
    },
  )
}

function initExtension() {
  const viewerContent = document.getElementById('viewerContent')
  const leftPane = document.getElementById('leftPane')

  if (!viewerContent || !leftPane) return

  const isMainComponentChild = leftPane.closest('#mainComponent') !== null
  const existingResizer = document.getElementById('custom-resizer-handle')
  const existingStyles = document.getElementById('custom-resizer-styles')

  if (isMainComponentChild) {
    if (existingResizer) existingResizer.remove()
    if (existingStyles) existingStyles.remove()
    return
  }

  if (existingResizer) return

  // 1. Create the Divider/Handle Element
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

  // 2. Inject CSS targeting the <main> tag directly
  const styleOverride = document.createElement('style')
  styleOverride.id = 'custom-resizer-styles'
  styleOverride.innerHTML = `

    #rightPlayersContainer {
      position: relative
    }

    #primaryScreen {
      width: 100% !important;
      top: 0 !important;
      left: 0 !important;
      margin: 0 !important;
      position: relative;
    }
    #primaryPlayer {
      position: absolute;
      height: 100%;
      width: 100%;
    }


    #primaryPlayer.roaming {
      left: 0 !important;
      top: 0 !important;
      height: 30% !important;
      width: 100% !important;
    }

    .secondary-content.object-video{
      height: 100%;
    }
    
    #secondaryScreen {
      width: 100% !important;
      height:  100% !important;
      left: 0 !important;
      top: 0 !important;
      margin: 0 !important;
    }
    #viewerContent {
      display: flex !important;
      flex-direction: row !important;
      width: 100% !important;
      box-sizing: border-box !important;
    }

    #leftPane {
      flex: 0 0 auto !important;
      max-width: none !important;
      width: var(--left-pane-width, 460px) !important;
    }

    #leftPlayerContainer { 
      position: relative;
    }

    #leftPane #leftPlayerContainer, 
    #leftPane #primaryPlayer, 
    #leftPane #primaryScreen:not(.roaming),
    #leftPane #eventTabPanes,
    #leftPane #searchTabPane,
    #leftPane #contentsTabPane {
      width: var(--left-pane-width, 460px) !important;
    }

    /* Target the <main> element directly by tag name */
    #viewerContent > main {
      flex: 1 1 0% !important;
      min-width: 0 !important;
      width: auto !important;
      max-width: none !important;
      position: relative !important;
      left: auto !important;
      right: auto !important;
      
      .secondaryPlayer:not(.roaming) {
        position: relative !important;
        height: 100% !important;
        width: 100% !important;
      }
      .secondaryPlayer.roaming {
        width: 100% !important;
        top: 0 !important;
        height: 100% !important;
        position: relative !important;
      }
      div.secondary-content.object-video {
        position: absolute !important;
        width: 100% !important;
        height: 100% !important;
      }
        
      #thumbnailList {
        width: 100% !important;
      }

      #rightPlayersContainer{
        width: 100% !important;
      }
    }
  `

  // styleOverride.innerHTML = ''
  document.head.appendChild(styleOverride)

  // Helper function to grab the <main> element by tag name and strip inline overrides
  function neutralizeMainElement() {
    const mainEl = viewerContent.querySelector('main')
    if (mainEl) {
      mainEl.style.width = ''
      mainEl.style.left = ''
      mainEl.style.position = 'relative'
    }
  }

  neutralizeMainElement()

  // 3. Dragging Logic
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
    const maxWidth = window.innerWidth * 0.5

    if (newWidth < minWidth) newWidth = minWidth
    if (newWidth > maxWidth) newWidth = maxWidth

    // Update CSS variable for smooth resizing
    viewerContent.style.setProperty('--left-pane-width', `${newWidth}px`)
    leftPane.style.width = `${newWidth}px`

    // Continuously keep inline styles cleared on the <main> element during drag
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
let swapListenerInitialized = false

function setupSwapButtonListener() {
  if (swapListenerInitialized) return
  swapListenerInitialized = true

  // Event delegation: Listens on the entire document body.
  // Whenever *any* click happens, it checks if the clicked element (or its parent) matches ".swap-streams-btn".
  document.addEventListener(
    'click',
    (event) => {
      const swapBtn = event.target.closest('.swap-streams-button')
      if (!swapBtn) return

      const primaryScreen = document.getElementById('primaryScreen')
      const secondaryScreen = document.getElementById('secondaryScreen')

      if (primaryScreen && secondaryScreen) {
        swapElements(primaryScreen, secondaryScreen)
        console.log(
          'Successfully swapped primaryScreen and secondaryScreen places.',
        )
      }
    },
    true,
  ) // Use capture phase (true) to ensure we catch it before other handlers if needed
}

// Clean helper to swap two DOM elements in place
function swapElements(node1, node2) {
  const afterNode2 = node2.nextElementSibling
  const parent2 = node2.parentNode
  node1.replaceWith(node2)
  parent2.insertBefore(node1, afterNode2)
  console.log('swap successful')
}

const observer = new MutationObserver(() => {
  initExtension()
})

observer.observe(document.body, {
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
