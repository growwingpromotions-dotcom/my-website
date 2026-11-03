/* ==========================================================================
   GROW WING - Digital Marketing & Advertising Agency
   Lightweight, Smooth & Minimal JavaScript (script.js)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  // 1. Sticky Navigation Blur & Shadow on Scroll
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 30) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });

  // 2. Mobile Menu Toggle
  const menuToggle = document.getElementById('menuToggle');
  const navMenu = document.getElementById('navMenu');
  const navLinks = document.querySelectorAll('.nav-link');

  if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', () => {
      navMenu.classList.toggle('open');
      const icon = menuToggle.querySelector('i');
      if (navMenu.classList.contains('open')) {
        icon.classList.remove('fa-bars');
        icon.classList.add('fa-xmark');
      } else {
        icon.classList.remove('fa-xmark');
        icon.classList.add('fa-bars');
      }
    });

    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('open');
        const icon = menuToggle.querySelector('i');
        icon.classList.remove('fa-xmark');
        icon.classList.add('fa-bars');
      });
    });
  }

  // 3. Active Nav Link on Scroll (ScrollSpy)
  const sections = document.querySelectorAll('section[id]');
  window.addEventListener('scroll', () => {
    const scrollPos = window.pageYOffset + 120;

    sections.forEach(section => {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      const id = section.getAttribute('id');
      const targetLink = document.querySelector(`.nav-menu a[href="#${id}"]`);

      if (targetLink) {
        if (scrollPos >= top && scrollPos < top + height) {
          navLinks.forEach(l => l.classList.remove('active'));
          targetLink.classList.add('active');
        }
      }
    });
  });

  // 4. Dynamic Portfolio Projects Fetching & Filtering
  const portfolioGrid = document.getElementById('portfolioGrid');
  const filterChips = document.querySelectorAll('.filter-chip');
  
  if (portfolioGrid) {
    fetch('/api/projects')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.projects.length) {
          portfolioGrid.innerHTML = data.projects.map(p => `
            <div class="work-card" data-category="${p.category}">
              <div class="work-img-wrap">
                <img src="${p.image_url}" alt="${p.title}" onerror="this.src='images/portfolio-1.jpg'">
                <span class="work-category-badge">${p.category}</span>
              </div>
              <div class="work-content">
                <h3 class="work-title">${p.title}</h3>
                <p class="work-desc">${p.description}</p>
                <div class="work-meta">
                  <span class="metric-tag">${p.metric_tag}</span>
                  <span class="metric-number">${p.metric_num}</span>
                </div>
              </div>
            </div>
          `).join('');
          
          // Re-initialize filtering on the newly created cards
          const workCards = document.querySelectorAll('.work-card');
          filterChips.forEach(chip => {
            chip.addEventListener('click', () => {
              filterChips.forEach(c => c.classList.remove('active'));
              chip.classList.add('active');
              const filter = chip.getAttribute('data-filter');
              
              workCards.forEach(card => {
                if (filter === 'all' || card.getAttribute('data-category') === filter) {
                  card.style.display = 'flex';
                  card.style.opacity = '0';
                  setTimeout(() => {
                    card.style.transition = 'opacity 0.3s ease';
                    card.style.opacity = '1';
                  }, 10);
                } else {
                  card.style.display = 'none';
                }
              });
            });
          });
        } else {
          portfolioGrid.innerHTML = '<p style="text-align:center;width:100%;color:#888;">No projects to display.</p>';
        }
      })
      .catch(err => {
        console.error('Error fetching projects:', err);
        portfolioGrid.innerHTML = '<p style="text-align:center;width:100%;color:#888;">Unable to load projects at this time.</p>';
      });
  }

  // ========================================================================
  // 5. Contact Form Submission — GROW WING Local Database (SQLite via Node.js)
  // ========================================================================

  const leadForm = document.getElementById('leadForm');
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');

  function showToast(message, isSuccess = true) {
    if (!toast || !toastMsg) return;
    toastMsg.textContent = message;
    const icon = toast.querySelector('i');
    if (icon) {
      icon.className = isSuccess ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle-exclamation';
      icon.style.color = isSuccess ? 'var(--color-accent)' : '#e63946';
    }
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 5500);
  }

  if (leadForm) {
    leadForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitBtn = leadForm.querySelector('button[type="submit"]');
      const originalBtnHtml = submitBtn ? submitBtn.innerHTML : 'Submit';

      const fullName      = document.getElementById('fullName').value.trim();
      const workEmail     = document.getElementById('workEmail').value.trim();
      const brandName     = document.getElementById('brandName').value.trim();
      const contactNumber = document.getElementById('contactNumber') ? document.getElementById('contactNumber').value.trim() : '';
      const serviceType   = document.getElementById('serviceType').value;
      const projectNotes  = document.getElementById('projectNotes').value.trim();

      // UI Loading state
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Submitting Proposal...</span> <i class="fa-solid fa-spinner fa-spin"></i>';
      }

      try {
        const response = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fullName, workEmail, brandName, contactNumber, serviceType, projectNotes })
        });

        const data = await response.json();

        if (data.success) {
          showToast(data.message, true);
          leadForm.reset();
        } else {
          showToast(data.message || 'Submission failed. Please try again.', false);
        }
      } catch (error) {
        console.error('Form submission error:', error);
        showToast('Cannot connect to server. Please email us at contact@growwingagency.com', false);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnHtml;
        }
      }
    });
  }

  // 6. WhatsApp Instant Chat Button
  const whatsappBtn = document.getElementById('whatsappBtn');
  if (whatsappBtn) {
    whatsappBtn.addEventListener('click', () => {
      const fullName = document.getElementById('fullName') ? document.getElementById('fullName').value.trim() : '';
      const brandName = document.getElementById('brandName') ? document.getElementById('brandName').value.trim() : '';
      const serviceType = document.getElementById('serviceType') ? document.getElementById('serviceType').value : '';
      const projectNotes = document.getElementById('projectNotes') ? document.getElementById('projectNotes').value.trim() : '';

      let text = "Hi GROW WING! I would like to inquire about advertising and marketing services.";
      if (fullName || brandName || serviceType) {
        text = `Hi GROW WING!%0A` +
               `*Name:* ${encodeURIComponent(fullName || 'Not specified')}%0A` +
               `*Brand:* ${encodeURIComponent(brandName || 'Not specified')}%0A` +
               `*Service:* ${encodeURIComponent(serviceType || 'Advertising & Marketing')}%0A` +
               `*Message:* ${encodeURIComponent(projectNotes || 'Looking for growth strategy')}`;
      }

      // Open WhatsApp chat directly
      const waUrl = `https://wa.me/message/GFJMDBTPGPJFM1`;
      window.open(waUrl, '_blank');
    });
  }

  // 7. Dynamic Copyright Year
  const yearSpan = document.getElementById('yearSpan');
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }

});
