/*
  Builds every page from content.json.

  Safety: all text is inserted with textContent (never innerHTML), and every
  link or image address goes through toSafeUrl(), so nothing in content.json
  can inject markup or run a script.
*/
"use strict";

(function () {
  const NEWS_VISIBLE_COUNT = 5;
  const PAGE_NAME = document.body.dataset.page || "home";
  const ALLOWED_URL_SCHEMES = ["http", "https", "mailto", "tel"];

  // Pages a "page_link" section can point to. The address is fixed here, never taken from content.json.
  const LINKABLE_PAGES = {
    transcript: { href: "transcript.html", defaultLabel: "Click here for my full unofficial transcript" },
    resume: { href: "resume.html", defaultLabel: "Click here to open my resume (PDF)" },
  };

  // Colour-coded course statuses for the course map. The class names are fixed here, never taken from content.json.
  const COURSE_STATUSES = {
    transfer: { label: "Transfer credit", className: "course-status-transfer" },
    complete: { label: "Complete", className: "course-status-complete" },
    in_progress: { label: "In progress", className: "course-status-in-progress" },
    registered: { label: "Registered", className: "course-status-registered" },
    planned: { label: "Planned", className: "course-status-planned" },
  };

  /* ---------- Small helpers ---------- */

  function toSafeUrl(rawUrl) {
    if (typeof rawUrl !== "string") return null;
    const trimmedUrl = rawUrl.trim();
    if (trimmedUrl === "") return null;
    // Browsers ignore whitespace and control characters inside a scheme
    // ("java\tscript:"), so strip them before checking the scheme.
    const normalizedUrl = trimmedUrl.replace(/[\u0000- \u007f]/g, "");
    const schemeMatch = /^([a-z][a-z0-9+.-]*):/i.exec(normalizedUrl);
    if (schemeMatch === null) return trimmedUrl; // relative path such as files/resume.pdf
    return ALLOWED_URL_SCHEMES.includes(schemeMatch[1].toLowerCase()) ? trimmedUrl : null;
  }

  function createElement(tagName, options = {}, children = []) {
    const element = document.createElement(tagName);
    if (options.className) element.className = options.className;
    if (options.text !== undefined && options.text !== null) element.textContent = String(options.text);
    if (options.attributes) {
      for (const [attributeName, attributeValue] of Object.entries(options.attributes)) {
        if (attributeValue !== null && attributeValue !== undefined) element.setAttribute(attributeName, attributeValue);
      }
    }
    for (const child of children) if (child) element.appendChild(child);
    return element;
  }

  function createLink(label, rawUrl, className) {
    const safeUrl = toSafeUrl(rawUrl);
    if (safeUrl === null) return createElement("span", { className, text: label });
    const isExternal = /^https?:/i.test(safeUrl);
    return createElement("a", {
      className,
      text: label,
      attributes: {
        href: safeUrl,
        target: isExternal ? "_blank" : null,
        rel: isExternal ? "noopener noreferrer" : null,
      },
    });
  }

  function createParagraphs(text, className) {
    if (typeof text !== "string" || text.trim() === "") return [];
    return text
      .split(/\n\s*\n/)
      .map((paragraphText) => paragraphText.trim())
      .filter(Boolean)
      .map((paragraphText) => createElement("p", { className, text: paragraphText }));
  }

  function asList(value) {
    return Array.isArray(value) ? value : [];
  }

  // The editor finds editable lists through these two data attributes.
  function markList(element, listPath, itemType) {
    element.dataset.listPath = listPath;
    element.dataset.itemType = itemType;
    return element;
  }

  function markItem(element, itemIndex) {
    element.dataset.itemIndex = String(itemIndex);
    return element;
  }

  /* ---------- Header, menu, footer ---------- */

  // "Email: you@example.com" becomes a plain "Email:" label followed by the address as the link.
  // Labels without a colon (e.g. "Resume (PDF)") stay a single link.
  function createLabelledLink(labelText, rawUrl) {
    const colonMatch = /^([^:]+:)\s+(\S.*)$/.exec(labelText);
    if (!colonMatch) return [createLink(labelText, rawUrl)];
    return [
      createElement("span", { className: "contact-label", text: colonMatch[1] }),
      document.createTextNode(" "),
      createLink(colonMatch[2], rawUrl),
    ];
  }

  function renderLinkList(links, listPath, splitLabels) {
    const listElement = createElement("ul", { className: "contact-links" });
    if (listPath) markList(listElement, listPath, "link");
    asList(links).forEach((link, linkIndex) => {
      const labelText = link.label || link.url || "";
      const listItem = createElement("li", {}, splitLabels ? createLabelledLink(labelText, link.url) : [createLink(labelText, link.url)]);
      if (listPath) markItem(listItem, linkIndex);
      listElement.appendChild(listItem);
    });
    return listElement;
  }

  // Header links for visitors: "Label: value" links get their own row, and links without a label
  // that sit next to each other share one row ("GitHub · LinkedIn"). While editing, every link
  // keeps its own row so the editor's controls fit.
  function renderHeaderLinks(links, editing) {
    if (editing) return renderLinkList(links, "profile.links", true);
    const listElement = createElement("ul", { className: "contact-links" });
    let currentGroupItem = null;
    for (const link of asList(links)) {
      const labelText = link.label || link.url || "";
      const linkParts = createLabelledLink(labelText, link.url);
      const hasLabel = linkParts.length > 1;
      if (hasLabel) {
        currentGroupItem = null;
        listElement.appendChild(createElement("li", {}, linkParts));
      } else if (currentGroupItem) {
        currentGroupItem.append(createElement("span", { className: "contact-link-separator", text: "·" }), ...linkParts);
      } else {
        currentGroupItem = createElement("li", { className: "contact-link-group" }, linkParts);
        listElement.appendChild(currentGroupItem);
      }
    }
    return listElement;
  }

  function renderHeader(content, editing) {
    const profile = content.profile || {};
    const landingElement = document.getElementById("landing");
    landingElement.replaceChildren();

    const textColumn = createElement("div", { className: "landing-text" });
    textColumn.appendChild(createElement("div", { className: "landing-name", text: profile.name || "" }));
    if (profile.role) textColumn.appendChild(createElement("div", { className: "landing-role", text: profile.role }));

    const educationLines = [
      profile.school,
      profile.program,
      profile.specialization,
      profile.expected_graduation ? `Expected graduation: ${profile.expected_graduation}` : "",
      profile.gpa ? `GPA: ${profile.gpa}` : "",
    ].filter(Boolean);
    const detailsElement = createElement("div", { className: "landing-details" });
    for (const educationLine of educationLines) detailsElement.appendChild(createElement("div", { text: educationLine }));
    textColumn.appendChild(detailsElement);
    textColumn.appendChild(renderHeaderLinks(profile.links, editing));
    landingElement.appendChild(textColumn);

    const headshotUrl = toSafeUrl(profile.headshot);
    if (headshotUrl) {
      const headshotImage = createElement("img", {
        attributes: { src: headshotUrl, alt: profile.headshot_alt || profile.name || "Headshot" },
      });
      landingElement.appendChild(createElement("div", { className: "headshot" }, [headshotImage]));
    }
    addHeadshotSizingListeners();
    requestAnimationFrame(sizeHeadshotToText);
  }

  /* Make the square headshot exactly as tall as the text beside it (name down to the last link row).
     Only on wider screens: phones stack the photo above the text. While editing, the photo keeps its
     normal size so its "Upload new photo" button fits underneath. */
  const PHONE_LAYOUT_QUERY = window.matchMedia("(max-width: 640px)");

  function sizeHeadshotToText() {
    const landingElement = document.getElementById("landing");
    const headshotElement = landingElement && landingElement.querySelector(".headshot");
    const textColumn = landingElement && landingElement.querySelector(".landing-text");
    if (!headshotElement || !textColumn) return;
    if (PHONE_LAYOUT_QUERY.matches || document.body.classList.contains("editor-active")) {
      headshotElement.style.width = "";
      headshotElement.style.maxWidth = "";
      return;
    }
    const largestWidth = landingElement.clientWidth * 0.45;
    // Narrowing the text column can make its lines wrap, so measure twice.
    for (let measureCount = 0; measureCount < 2; measureCount++) {
      headshotElement.style.maxWidth = "none";
      headshotElement.style.width = `${Math.min(textColumn.offsetHeight, largestWidth)}px`;
    }
  }

  let headshotSizingListenersAdded = false;
  function addHeadshotSizingListeners() {
    if (headshotSizingListenersAdded) return;
    headshotSizingListenersAdded = true;
    window.addEventListener("resize", sizeHeadshotToText);
    window.addEventListener("load", sizeHeadshotToText);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(sizeHeadshotToText);
  }

  // A section's menu name is whatever was set in the editor, or its title in lowercase.
  function getSectionMenuLabel(section) {
    if (section.menu_label) return section.menu_label;
    return String(section.title || section.id || "").toLowerCase();
  }

  // Returns the section this one sits under in the menu, or null if it is a top-level item.
  // Only one level is allowed: a parent that is itself under another item is ignored.
  function getMenuParent(section, sectionsById) {
    const parentSection = section.menu_parent ? sectionsById.get(section.menu_parent) : null;
    const parentIsNested = Boolean(parentSection && parentSection.menu_parent && sectionsById.has(parentSection.menu_parent));
    if (!parentSection || parentSection === section || parentIsNested) return null;
    return parentSection;
  }

  function closeAllMenuDropdowns(exceptMenuItem) {
    for (const openMenuItem of document.querySelectorAll("#menu .menu-item.is-open")) {
      if (openMenuItem === exceptMenuItem) continue;
      openMenuItem.classList.remove("is-open");
      const toggleButton = openMenuItem.querySelector(".menu-dropdown-toggle");
      if (toggleButton) toggleButton.setAttribute("aria-expanded", "false");
    }
  }

  // Clicking anywhere else, or pressing Escape, closes an open dropdown. Added once per page.
  let menuDropdownListenersAdded = false;
  function addMenuDropdownListeners() {
    if (menuDropdownListenersAdded) return;
    menuDropdownListenersAdded = true;
    document.addEventListener("click", (clickEvent) => {
      closeAllMenuDropdowns(clickEvent.target.closest ? clickEvent.target.closest("#menu .menu-item") : null);
    });
    document.addEventListener("keydown", (keyEvent) => {
      if (keyEvent.key === "Escape") closeAllMenuDropdowns(null);
    });
  }

  // Visitors don't see sections that have nothing in them yet (the editor still shows them so they can be filled).
  function isSectionEmpty(section) {
    if (section.type === "page_link") return false;
    const hasBody = typeof section.body === "string" && section.body.trim() !== "";
    return !hasBody && asList(section.items).length === 0 && asList(section.prior_items).length === 0;
  }

  function renderMenu(content, editing) {
    const menuElement = document.getElementById("menu");
    const menuList = createElement("ul", { className: "menu-list" });
    const sectionLinkPrefix = PAGE_NAME === "home" ? "" : "index.html";
    const sections = asList(content.sections).filter((section) => section && section.id && (editing || !isSectionEmpty(section)));
    const sectionsById = new Map(sections.map((section) => [section.id, section]));

    function createSectionLink(section) {
      // On the transcript or resume page, highlight the section that links to it.
      const isCurrentPage = section.type === "page_link" && section.page === PAGE_NAME;
      return createElement("a", {
        text: getSectionMenuLabel(section),
        attributes: { href: `${sectionLinkPrefix}#${section.id}`, "aria-current": isCurrentPage ? "page" : null },
      });
    }

    // A link straight to the page a "page_link" section points to (e.g. "Unofficial Transcript"),
    // shown first in that section's dropdown.
    function createLinkedPageLink(section) {
      if (section.type !== "page_link") return null;
      if (section.page === "transcript") {
        const transcriptTitle = (content.transcript && content.transcript.title) || "Unofficial Transcript";
        return createElement("a", {
          text: transcriptTitle,
          attributes: { href: LINKABLE_PAGES.transcript.href, "aria-current": PAGE_NAME === "transcript" ? "page" : null },
        });
      }
      const resumePdfUrl = section.page === "resume" && content.resume ? toSafeUrl(content.resume.pdf_url) : null;
      if (resumePdfUrl) return createElement("a", { text: "Resume (PDF)", attributes: { href: resumePdfUrl, target: "_blank", rel: "noopener" } });
      return null;
    }

    for (const section of sections) {
      if (getMenuParent(section, sectionsById)) continue;
      const childSections = sections.filter((otherSection) => getMenuParent(otherSection, sectionsById) === section);
      const menuItem = createElement("li", { className: "menu-item" }, [createSectionLink(section)]);

      if (childSections.length) {
        const dropdownId = `menu-dropdown-${section.id}`;
        const dropdownList = createElement("ul", { className: "menu-dropdown", attributes: { id: dropdownId } });
        const linkedPageLink = createLinkedPageLink(section);
        if (linkedPageLink) dropdownList.appendChild(createElement("li", {}, [linkedPageLink]));
        for (const childSection of childSections) dropdownList.appendChild(createElement("li", {}, [createSectionLink(childSection)]));
        const toggleButton = createElement("button", {
          className: "menu-dropdown-toggle",
          text: "▾",
          attributes: {
            type: "button",
            "aria-expanded": "false",
            "aria-controls": dropdownId,
            "aria-label": `More under ${getSectionMenuLabel(section)}`,
          },
        });
        toggleButton.addEventListener("click", () => {
          const shouldOpen = !menuItem.classList.contains("is-open");
          closeAllMenuDropdowns(menuItem);
          menuItem.classList.toggle("is-open", shouldOpen);
          toggleButton.setAttribute("aria-expanded", String(shouldOpen));
        });
        // Close when keyboard focus moves out of this item.
        menuItem.addEventListener("focusout", (focusEvent) => {
          if (!menuItem.contains(focusEvent.relatedTarget)) {
            menuItem.classList.remove("is-open");
            toggleButton.setAttribute("aria-expanded", "false");
          }
        });
        menuItem.classList.add("has-dropdown");
        menuItem.append(toggleButton, dropdownList);
      }
      menuList.appendChild(menuItem);
    }

    addMenuDropdownListeners();
    menuElement.replaceChildren(menuList);
    addStickyMenuListeners();
    updateStickyMenu();
  }

  /* The menu sticks to the top while scrolling. This adds a faint shadow once it is stuck,
     and tells the CSS how tall it is so jumping to a section doesn't hide the heading under it. */
  function updateStickyMenu() {
    const menuElement = document.getElementById("menu");
    if (!menuElement) return;
    const isStuck = window.scrollY > 0 && menuElement.getBoundingClientRect().top <= 0;
    menuElement.classList.toggle("is-stuck", isStuck);
    document.documentElement.style.setProperty("--menu-height", `${menuElement.offsetHeight}px`);
  }

  let stickyMenuListenersAdded = false;
  function addStickyMenuListeners() {
    if (stickyMenuListenersAdded) return;
    stickyMenuListenersAdded = true;
    window.addEventListener("scroll", updateStickyMenu, { passive: true });
    window.addEventListener("resize", updateStickyMenu);
  }

  function renderFooter(content) {
    const profile = content.profile || {};
    const footerElement = document.getElementById("footer");
    footerElement.replaceChildren(
      createElement("p", { className: "back-to-top" }, [createElement("a", { text: "Back to top", attributes: { href: "#" } })])
    );
    if (content.last_updated) footerElement.appendChild(createElement("div", { text: `Last updated ${content.last_updated}` }));
    footerElement.appendChild(createElement("div", { text: `© ${new Date().getFullYear()} ${profile.name || ""}`.trim() }));
  }

  /* ---------- Home page section types ---------- */

  function renderEntry(entry) {
    const entryElement = createElement("div", { className: "entry" });
    const headerElement = createElement("div", { className: "entry-header" });
    const titleIsLink = entry.link_url && !entry.link_label;
    headerElement.appendChild(
      titleIsLink
        ? createLink(entry.title || "", entry.link_url, "entry-title")
        : createElement("span", { className: "entry-title", text: entry.title || "" })
    );
    // Right side of the title line: the dates, then the link (e.g. "GitHub repository"), like on the resume.
    const metaElement = createElement("span", { className: "entry-meta" });
    if (entry.dates) metaElement.appendChild(createElement("span", { className: "entry-dates", text: entry.dates }));
    if (entry.link_label) {
      if (entry.dates) metaElement.appendChild(createElement("span", { className: "entry-meta-separator", text: "·" }));
      metaElement.appendChild(createLink(entry.link_label, entry.link_url, "entry-link"));
    }
    if (metaElement.childNodes.length) headerElement.appendChild(metaElement);
    entryElement.appendChild(headerElement);

    const organizationLine = [entry.organization, entry.location].filter(Boolean).join(" · ");
    if (organizationLine) entryElement.appendChild(createElement("div", { className: "entry-organization", text: organizationLine }));
    for (const paragraph of createParagraphs(entry.description, "entry-description")) entryElement.appendChild(paragraph);

    const bullets = asList(entry.bullets).filter((bullet) => typeof bullet === "string" && bullet.trim());
    if (bullets.length) {
      const bulletList = createElement("ul", { className: "entry-bullets" });
      for (const bullet of bullets) bulletList.appendChild(createElement("li", { text: bullet }));
      entryElement.appendChild(bulletList);
    }

    return entryElement;
  }

  const SECTION_RENDERERS = {
    about(section, sectionIndex, sectionElement, editing) {
      for (const paragraph of createParagraphs(section.body)) sectionElement.appendChild(paragraph);
      const interests = asList(section.items);
      if (interests.length || editing) {
        sectionElement.appendChild(createElement("h3", { className: "subheading", text: section.interests_title || "Interests" }));
      }
      const interestList = markList(createElement("ul", { className: "interest-list" }), `sections.${sectionIndex}.items`, "interest");
      interests.forEach((interest, interestIndex) => {
        interestList.appendChild(markItem(createElement("li", { text: interest.text || "" }), interestIndex));
      });
      sectionElement.appendChild(interestList);
    },

    entries(section, sectionIndex, sectionElement) {
      const entryList = markList(createElement("div", { className: "entry-list" }), `sections.${sectionIndex}.items`, "entry");
      asList(section.items).forEach((entry, entryIndex) => entryList.appendChild(markItem(renderEntry(entry), entryIndex)));
      sectionElement.appendChild(entryList);
    },

    news(section, sectionIndex, sectionElement, editing) {
      const newsItems = asList(section.items);
      const newsList = markList(createElement("div", { className: "news-list" }), `sections.${sectionIndex}.items`, "news");
      const hiddenRows = [];

      newsItems.forEach((newsItem, newsIndex) => {
        const textElement = createElement("div", { className: "news-text", text: newsItem.text || "" });
        if (newsItem.link_url) {
          textElement.appendChild(document.createTextNode(" "));
          textElement.appendChild(createLink(newsItem.link_label || "link", newsItem.link_url));
        }
        const row = createElement("div", { className: "news-row" }, [
          createElement("div", { className: "news-date", text: newsItem.date || "" }),
          textElement,
        ]);
        if (!editing && newsIndex >= NEWS_VISIBLE_COUNT) {
          row.hidden = true;
          hiddenRows.push(row);
        }
        newsList.appendChild(markItem(row, newsIndex));
      });
      sectionElement.appendChild(newsList);

      if (hiddenRows.length) {
        const showAllLabel = `Show all news (${hiddenRows.length} more) ▾`;
        const toggleButton = createElement("button", { className: "news-toggle", text: showAllLabel, attributes: { type: "button" } });
        toggleButton.addEventListener("click", () => {
          const isShowingAll = !hiddenRows[0].hidden;
          for (const row of hiddenRows) row.hidden = isShowingAll;
          toggleButton.textContent = isShowingAll ? showAllLabel : "Show less ▴";
        });
        sectionElement.appendChild(toggleButton);
      }
    },

    tech(section, sectionIndex, sectionElement) {
      const techList = markList(createElement("div", { className: "tech-list" }), `sections.${sectionIndex}.items`, "tech_group");
      asList(section.items).forEach((techGroup, groupIndex) => {
        const valuesElement = createElement("div", { className: "tech-values" });
        const technologies = String(techGroup.items || "").split(",").map((technology) => technology.trim()).filter(Boolean);
        for (const technology of technologies) valuesElement.appendChild(createElement("span", { className: "tech-tag", text: technology }));
        const row = createElement("div", { className: "tech-row" }, [
          createElement("div", { className: "tech-category", text: techGroup.category || "" }),
          valuesElement,
        ]);
        techList.appendChild(markItem(row, groupIndex));
      });
      sectionElement.appendChild(techList);
    },

    courses(section, sectionIndex, sectionElement) {
      const courseList = markList(createElement("div", { className: "course-list" }), `sections.${sectionIndex}.items`, "course");
      asList(section.items).forEach((course, courseIndex) => {
        const headerElement = createElement("div", { className: "course-header" });
        if (course.code) headerElement.appendChild(createElement("span", { className: "course-code", text: course.code }));
        headerElement.appendChild(createElement("span", { className: "course-title", text: course.title || "" }));
        if (course.term) headerElement.appendChild(createElement("span", { className: "course-term", text: course.term }));
        const row = createElement("div", { className: "course-row" }, [headerElement, ...createParagraphs(course.description, "course-description")]);
        courseList.appendChild(markItem(row, courseIndex));
      });
      sectionElement.appendChild(courseList);
    },

    // A short section on the home page that links to the full transcript or resume page.
    page_link(section, sectionIndex, sectionElement, editing, content) {
      for (const paragraph of createParagraphs(section.body)) sectionElement.appendChild(paragraph);
      const linkedPage = LINKABLE_PAGES[section.page];
      if (!linkedPage) return;
      const linkLabel = section.link_label || linkedPage.defaultLabel;
      // The resume link opens the PDF itself in a new tab, using the browser's own PDF viewer.
      const resumePdfUrl = section.page === "resume" && content.resume ? toSafeUrl(content.resume.pdf_url) : null;
      const linkElement = resumePdfUrl
        ? createElement("a", { text: linkLabel, attributes: { href: resumePdfUrl, target: "_blank", rel: "noopener" } })
        : createElement("a", { text: linkLabel, attributes: { href: linkedPage.href } });
      sectionElement.appendChild(createElement("p", { className: "page-link" }, [linkElement]));
    },

    // A colour-coded grid of courses by term, with a legend, plus an optional second grid underneath
    // (used for the Centennial College courses).
    course_map(section, sectionIndex, sectionElement) {
      for (const paragraph of createParagraphs(section.body)) sectionElement.appendChild(paragraph);
      const legendList = createElement("ul", { className: "course-map-legend", attributes: { "aria-label": "Legend" } });
      for (const courseStatus of Object.values(COURSE_STATUSES)) {
        legendList.appendChild(createElement("li", {}, [
          createElement("span", { className: `course-map-swatch ${courseStatus.className}`, attributes: { "aria-hidden": "true" } }),
          createElement("span", { text: courseStatus.label }),
        ]));
      }
      sectionElement.appendChild(legendList);
      sectionElement.appendChild(renderCourseMapRows(section.items, `sections.${sectionIndex}.items`));

      if (section.prior_title || asList(section.prior_items).length) {
        if (section.prior_title) sectionElement.appendChild(createElement("h3", { className: "subheading course-map-prior-title", text: section.prior_title }));
        for (const paragraph of createParagraphs(section.prior_note, "course-map-prior-note")) sectionElement.appendChild(paragraph);
        sectionElement.appendChild(renderCourseMapRows(section.prior_items, `sections.${sectionIndex}.prior_items`));
      }
    },
  };

  function renderCourseMapRows(rows, listPath) {
    const rowList = markList(createElement("div", { className: "course-map" }), listPath, "course_map_row");
    asList(rows).forEach((row, rowIndex) => {
      const termElement = createElement("div", { className: "course-map-term" }, [createElement("span", { text: row.term || "" })]);
      if (row.note) termElement.appendChild(createElement("span", { className: "course-map-term-note", text: row.note }));
      const courseList = markList(createElement("div", { className: "course-map-courses" }), `${listPath}.${rowIndex}.courses`, "course_map_course");
      asList(row.courses).forEach((course, courseIndex) => {
        const courseStatus = COURSE_STATUSES[course.status] || COURSE_STATUSES.planned;
        const courseElement = createElement("div", {
          className: `course-map-course ${courseStatus.className}`,
          attributes: { title: `${[course.code, course.title].filter(Boolean).join(" ")} (${courseStatus.label})` },
        });
        if (course.code) courseElement.appendChild(createElement("span", { className: "course-map-code", text: course.code }));
        courseElement.appendChild(createElement("span", { className: "course-map-title", text: course.title || "" }));
        courseList.appendChild(markItem(courseElement, courseIndex));
      });
      rowList.appendChild(markItem(createElement("div", { className: "course-map-row" }, [termElement, courseList]), rowIndex));
    });
    return rowList;
  }

  function renderHomePage(content, mainElement, editing) {
    markList(mainElement, "sections", "section");
    asList(content.sections).forEach((section, sectionIndex) => {
      if (!editing && isSectionEmpty(section)) return;
      const sectionElement = createElement("section", { className: "portfolio-section", attributes: { id: section.id } });
      sectionElement.appendChild(createElement("h1", { className: "section-heading", text: section.title || "" }));
      const sectionRenderer = SECTION_RENDERERS[section.type];
      if (sectionRenderer) sectionRenderer(section, sectionIndex, sectionElement, editing, content);
      mainElement.appendChild(markItem(sectionElement, sectionIndex));
    });
  }

  /* ---------- Transcript page ---------- */

  function renderTranscriptTerm(term, termListPath, termIndex) {
    const termElement = createElement("div", { className: "transcript-term" });
    const termHeader = createElement("div", { className: "transcript-term-header" }, [
      createElement("h3", { className: "subheading", text: term.term || "" }),
    ]);
    const termBadges = createElement("div", { className: "transcript-term-badges" });
    if (term.standing) termBadges.appendChild(createElement("span", { className: "transcript-badge", text: term.standing }));
    if (term.term_gpa) termBadges.appendChild(createElement("span", { className: "transcript-term-gpa", text: `Term GPA ${term.term_gpa}` }));
    termHeader.appendChild(termBadges);
    termElement.appendChild(termHeader);

    const headerRow = createElement("tr", {}, [
      createElement("th", { text: "Code" }),
      createElement("th", { text: "Course" }),
      createElement("th", { className: "column-number", text: "Credits" }),
      createElement("th", { className: "column-number", text: "Grade" }),
    ]);
    const tableBody = markList(createElement("tbody"), `${termListPath}.${termIndex}.courses`, "transcript_course");
    asList(term.courses).forEach((course, courseIndex) => {
      const courseRow = createElement("tr", {}, [
        createElement("td", { className: "column-code", text: course.code || "" }),
        createElement("td", { text: course.title || "" }),
        createElement("td", { className: "column-number", text: course.credits || "" }),
        createElement("td", { className: "column-number column-grade", text: course.grade || "—" }),
      ]);
      tableBody.appendChild(markItem(courseRow, courseIndex));
    });
    const table = createElement("table", { className: "transcript-table" }, [createElement("thead", {}, [headerRow]), tableBody]);
    termElement.appendChild(createElement("div", { className: "table-wrapper" }, [table]));
    return termElement;
  }

  // A link that opens the original transcript PDFs in a new tab, using the browser's own PDF viewer.
  function renderTranscriptDocuments(transcript) {
    const pdfUrl = toSafeUrl(transcript.documents_pdf_url);
    if (!pdfUrl) return null;
    return createElement("p", { className: "page-link transcript-documents-link" }, [
      createElement("a", {
        text: transcript.documents_label || "View documented unofficial transcripts (PDF)",
        attributes: { href: pdfUrl, target: "_blank", rel: "noopener" },
      }),
    ]);
  }

  // "Back to main page", shown at the bottom of the transcript and resume pages.
  function renderBackLink() {
    return createElement("p", { className: "back-link" }, [createElement("a", { text: "Back to main page", attributes: { href: "index.html" } })]);
  }

  function renderTranscriptPage(content, mainElement) {
    const transcript = content.transcript || {};
    const pageSection = createElement("section", { className: "portfolio-section" });
    pageSection.appendChild(createElement("h1", { className: "section-heading", text: transcript.title || "Unofficial Transcript" }));

    // The link to the original PDFs sits right under the heading.
    const documentsElement = renderTranscriptDocuments(transcript);
    if (documentsElement) pageSection.appendChild(documentsElement);
    if (transcript.note) pageSection.appendChild(createElement("p", { className: "transcript-note", text: transcript.note }));

    const groupList = markList(createElement("div", { className: "transcript-group-list" }), "transcript.groups", "transcript_group");
    asList(transcript.groups).forEach((group, groupIndex) => {
      const groupElement = createElement("div", { className: "transcript-group" });
      // The school's name, with its cumulative GPA on the right of the same line.
      const groupHeader = createElement("div", { className: "transcript-group-header" }, [
        createElement("h2", { className: "transcript-group-title", text: group.title || "" }),
      ]);
      if (group.gpa) groupHeader.appendChild(createElement("span", { className: "transcript-group-gpa", text: `cGPA ${group.gpa}` }));
      groupElement.appendChild(groupHeader);
      if (group.subtitle) groupElement.appendChild(createElement("div", { className: "transcript-group-subtitle", text: group.subtitle }));
      const termListPath = `transcript.groups.${groupIndex}.terms`;
      const termList = markList(createElement("div", { className: "transcript-term-list" }), termListPath, "transcript_term");
      asList(group.terms).forEach((term, termIndex) => termList.appendChild(markItem(renderTranscriptTerm(term, termListPath, termIndex), termIndex)));
      groupElement.appendChild(termList);
      groupList.appendChild(markItem(groupElement, groupIndex));
    });
    pageSection.appendChild(groupList);
    pageSection.appendChild(renderBackLink());
    mainElement.appendChild(pageSection);
  }

  /* ---------- Resume page ---------- */

  // The resume itself is a PDF; this page just links to it (the home page's Resume section links to the PDF directly).
  function renderResumePage(content, mainElement) {
    const resume = content.resume || {};
    const pageSection = createElement("section", { className: "portfolio-section" });
    pageSection.appendChild(createElement("h1", { className: "section-heading", text: resume.title || "Resume" }));
    const pdfUrl = toSafeUrl(resume.pdf_url);
    pageSection.appendChild(
      pdfUrl
        ? createElement("p", { className: "page-link" }, [createElement("a", { text: "Open my resume (PDF)", attributes: { href: pdfUrl, target: "_blank", rel: "noopener" } })])
        : createElement("p", { text: "The resume PDF hasn't been added yet." })
    );
    pageSection.appendChild(renderBackLink());
    mainElement.appendChild(pageSection);
  }

  /* ---------- Entry point ---------- */

  function render(content, options = {}) {
    const editing = Boolean(options.editing);
    const mainElement = document.getElementById("content");
    mainElement.replaceChildren();

    renderHeader(content, editing);
    renderMenu(content, editing);
    if (PAGE_NAME === "transcript") renderTranscriptPage(content, mainElement);
    else if (PAGE_NAME === "resume") renderResumePage(content, mainElement);
    else renderHomePage(content, mainElement, editing);
    renderFooter(content);

    const ownerName = (content.profile && content.profile.name) || "Portfolio";
    const pageTitles = { home: ownerName, transcript: `Unofficial Transcript · ${ownerName}`, resume: `Resume · ${ownerName}` };
    document.title = pageTitles[PAGE_NAME] || ownerName;
  }

  function showLoadError(error) {
    const mainElement = document.getElementById("content");
    mainElement.replaceChildren(
      createElement("p", {
        className: "load-error",
        text: "Could not load content.json. If you opened this file straight from your computer, preview it through a local server instead (see README).",
      })
    );
    console.error(error);
  }

  const ready = fetch("content.json", { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error(`content.json returned HTTP ${response.status}`);
      return response.json();
    })
    .then((content) => {
      render(content);
      // The browser tried to jump to #section before the sections existed, so
      // jump now, and again once images have loaded (they can push content down).
      if (location.hash) {
        const scrollToHashTarget = () => {
          const targetElement = document.getElementById(decodeURIComponent(location.hash.slice(1)));
          if (targetElement) targetElement.scrollIntoView({ behavior: "instant" });
        };
        scrollToHashTarget();
        if (document.readyState !== "complete") window.addEventListener("load", scrollToHashTarget, { once: true });
      }
      return content;
    })
    .catch((error) => {
      showLoadError(error);
      return null;
    });

  window.PortfolioRenderer = Object.freeze({ render, ready, toSafeUrl, getSectionMenuLabel, linkablePages: LINKABLE_PAGES, pageName: PAGE_NAME });
})();
