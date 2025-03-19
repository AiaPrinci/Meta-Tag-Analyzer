document.addEventListener('DOMContentLoaded', () => {
  // Analyze current tab
  chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
    const tab = tabs[0];
    
    const results = await chrome.scripting.executeScript({
      target: {tabId: tab.id},
      function: analyzePage,
    });

    const data = results[0].result;
    updateUI(data);
    analyzeSEO(data);
  });

  // Setup copy buttons
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', handleCopy);
  });
});

function analyzePage() {
  const getMetaContent = (name) => {
    const meta = document.querySelector(`meta[name="${name}"]`) || 
                document.querySelector(`meta[property="${name}"]`);
    return meta ? meta.getAttribute('content') : '';
  };

  const getCanonical = () => {
    const link = document.querySelector('link[rel="canonical"]');
    return link ? link.href : '';
  };

  const getHeadings = () => {
    const headings = [];
    for (let i = 1; i <= 6; i++) {
      const elements = document.querySelectorAll(`h${i}`);
      elements.forEach(el => {
        headings.push({
          level: i,
          text: el.textContent.trim()
        });
      });
    }
    return headings;
  };

  const getOpenGraphTags = () => {
    const ogTags = {};
    document.querySelectorAll('meta[property^="og:"]').forEach(tag => {
      const property = tag.getAttribute('property');
      ogTags[property] = tag.getAttribute('content');
    });
    return ogTags;
  };

  const getImages = () => {
    const images = Array.from(document.images);
    return images.map(img => ({
      src: img.src,
      alt: img.alt,
      width: img.width,
      height: img.height
    }));
  };

  const getLinks = () => {
    const links = Array.from(document.links);
    return links.map(link => ({
      href: link.href,
      text: link.textContent.trim(),
      isInternal: link.href.startsWith(window.location.origin)
    }));
  };

  return {
    title: document.title,
    description: getMetaContent('description'),
    robots: getMetaContent('robots'),
    canonical: getCanonical(),
    headings: getHeadings(),
    ogTags: getOpenGraphTags(),
    images: getImages(),
    links: getLinks()
  };
}

function updateUI(data) {
  // Update title
  const titleInfo = document.querySelector('#titleInfo .content');
  const titleLength = document.querySelector('#titleInfo .length-indicator');
  titleInfo.textContent = data.title;
  titleLength.textContent = `${data.title.length}/60`;
  titleLength.style.color = data.title.length > 60 ? 'var(--error-color)' : 'var(--success-color)';
  titleLength.className = `length-indicator ${data.title.length > 60 ? 'error' : 'success'}`;

  // Update description
  const descInfo = document.querySelector('#descriptionInfo .content');
  const descLength = document.querySelector('#descriptionInfo .length-indicator');
  descInfo.textContent = data.description;
  descLength.textContent = `${data.description.length}/160`;
  descLength.style.color = data.description.length > 160 ? 'var(--error-color)' : 'var(--success-color)';
  descLength.className = `length-indicator ${data.description.length > 160 ? 'error' : 'success'}`;

  // Update canonical
  document.querySelector('#canonicalInfo .content').textContent = data.canonical;

  // Update robots
  document.querySelector('#robotsInfo .content').textContent = data.robots || 'Non spécifié';

  // Update headings
  const headingsContainer = document.querySelector('#headingsStructure');
  headingsContainer.innerHTML = '';
  data.headings.forEach(heading => {
    const div = document.createElement('div');
    div.className = 'heading-item';
    div.innerHTML = `
      <span class="heading-tag">H${heading.level}</span>
      <span class="heading-content">${heading.text}</span>
    `;
    headingsContainer.appendChild(div);
  });

  // Update Open Graph tags
  const ogContainer = document.querySelector('#ogTags');
  ogContainer.innerHTML = '';
  Object.entries(data.ogTags).forEach(([property, content]) => {
    const div = document.createElement('div');
    div.className = 'og-tag';
    div.innerHTML = `
      <span>${property}</span>
      ${content}
    `;
    ogContainer.appendChild(div);
  });
}

function analyzeSEO(data) {
  const analysis = [];

  // Title analysis
  if (!data.title) {
    analysis.push({ type: 'error', message: 'Le titre est manquant' });
  } else if (data.title.length < 30) {
    analysis.push({ type: 'warning', message: 'Le titre est trop court (< 30 caractères)' });
  } else if (data.title.length > 60) {
    analysis.push({ type: 'error', message: 'Le titre est trop long (> 60 caractères)' });
  } else {
    analysis.push({ type: 'success', message: 'Le titre a une longueur optimale' });
  }

  // Description analysis
  if (!data.description) {
    analysis.push({ type: 'error', message: 'La meta description est manquante' });
  } else if (data.description.length < 120) {
    analysis.push({ type: 'warning', message: 'La meta description est trop courte (< 120 caractères)' });
  } else if (data.description.length > 160) {
    analysis.push({ type: 'error', message: 'La meta description est trop longue (> 160 caractères)' });
  } else {
    analysis.push({ type: 'success', message: 'La meta description a une longueur optimale' });
  }

  // Headings analysis
  const h1Count = data.headings.filter(h => h.level === 1).length;
  if (h1Count === 0) {
    analysis.push({ type: 'error', message: 'Aucune balise H1 trouvée' });
  } else if (h1Count > 1) {
    analysis.push({ type: 'warning', message: 'Plusieurs balises H1 détectées' });
  } else {
    analysis.push({ type: 'success', message: 'Structure des titres correcte' });
  }

  // Display analysis
  const analysisContainer = document.querySelector('#seoAnalysis');
  analysisContainer.innerHTML = analysis.map(item => `
    <div class="status ${item.type}">
      <i class="lucide lucide-${item.type === 'success' ? 'check-circle' : item.type === 'warning' ? 'alert-triangle' : 'x-circle'}"></i>
      ${item.message}
    </div>
  `).join('');
}

async function handleCopy(e) {
  const type = e.target.dataset.type;
  const content = e.target.parentElement.querySelector('.content').textContent;
  
  try {
    await navigator.clipboard.writeText(content);
    const originalText = e.target.textContent;
    e.target.innerHTML = '<i class="lucide lucide-check"></i> Copié !';
    setTimeout(() => {
      e.target.innerHTML = '<i class="lucide lucide-copy"></i> ' + originalText;
    }, 1500);
  } catch (err) {
    console.error('Failed to copy:', err);
  }
}