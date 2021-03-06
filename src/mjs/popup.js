/**
 * popup.js
 */

import {
  CONTEXT_INFO, CONTEXT_INFO_GET, PATH_SNS_DATA, SHARE_LINK, SHARE_PAGE,
  SHARE_SNS,
} from "./constant.js";
import {isObjectNotEmpty, isString, throwErr} from "./common.js";
import {fetchData, getActiveTab, getStorage, sendMessage} from "./browser.js";
import {localizeHtml} from "./localize.js";

/* api */
const {runtime, storage, tabs} = browser;

/* constants */
const {TAB_ID_NONE} = tabs;
const SNS_ITEMS = "snsItems";
const SNS_ITEM = "snsItem";
const SNS_ITEM_TMPL = "snsItemTemplate";
const SNS_NOT_SELECTED = "warnSnsNotSelected";

/* tab info */
const tabInfo = {
  tab: null,
};

/**
 * set tab info
 * @param {Object} tab - tabs.Tab
 * @returns {void}
 */
const setTabInfo = async tab => {
  tabInfo.tab = isObjectNotEmpty(tab) && tab || null;
};

/* sns */
const sns = new Map();

/**
 * fetch sns data
 * @returns {void}
 */
const fetchSnsData = async () => {
  const data = await fetchData(PATH_SNS_DATA);
  if (data) {
    const items = Object.entries(data);
    for (const item of items) {
      const [key, value] = item;
      sns.set(key, value);
    }
  }
};

/* context info */
const contextInfo = {
  isLink: false,
  content: null,
  selectionText: null,
  title: null,
  url: null,
  canonicalUrl: null,
};

/**
 * init context info
 * @returns {Object} - context info
 */
const initContextInfo = async () => {
  contextInfo.isLink = false;
  contextInfo.content = null;
  contextInfo.selectionText = null;
  contextInfo.title = null;
  contextInfo.url = null;
  contextInfo.canonicalUrl = null;
  return contextInfo;
};

/**
 * create share data
 * @param {!Object} evt - Event
 * @returns {?AsyncFunction} - sendMessage()
 */
const createShareData = async evt => {
  const {target} = evt;
  let func;
  if (target) {
    const {id: menuItemId} = target;
    const {tab} = tabInfo;
    if (tab) {
      const info = {
        menuItemId,
      };
      const {
        canonicalUrl, content, isLink, selectionText, title, url,
      } = contextInfo;
      if (isLink) {
        info.linkText = content || title;
        info.linkUrl = url;
      }
      info.canonicalUrl = canonicalUrl || null;
      info.selectionText = selectionText || "";
      func = sendMessage(runtime.id, {
        [SHARE_SNS]: {
          info, tab,
        },
      });
    }
  }
  return func || null;
};

/**
 * create html from template
 * @returns {void}
 */
const createHtml = async () => {
  const container = document.getElementById(SNS_ITEMS);
  const tmpl = document.getElementById(SNS_ITEM_TMPL);
  if (container && tmpl) {
    sns.forEach(value => {
      if (isObjectNotEmpty(value)) {
        const {id} = value;
        const {content} = tmpl;
        const item = content.querySelector(`.${SNS_ITEM}`);
        const {firstElementChild} = item;
        const page = item.querySelector(`.${SHARE_PAGE}`);
        const link = item.querySelector(`.${SHARE_LINK}`);
        if (item && firstElementChild && page && link) {
          item.id = id;
          firstElementChild.textContent = id;
          page.id = `${SHARE_PAGE}${id}`;
          page.dataset.i18n = `${SHARE_PAGE},${id}`;
          page.textContent = `Share page with ${id}`;
          link.id = `${SHARE_LINK}${id}`;
          link.dataset.i18n = `${SHARE_LINK},${id}`;
          link.textContent = `Share link with ${id}`;
          container.appendChild(document.importNode(content, true));
        }
      }
    });
  }
};

/**
 * add listener to menu
 * @returns {void}
 */
const addListenerToMenu = async () => {
  const nodes = document.querySelectorAll("button");
  if (nodes instanceof NodeList) {
    for (const node of nodes) {
      node.addEventListener("click", evt =>
        createShareData(evt).catch(throwErr)
      );
    }
  }
};

/**
 * update menu
 * @param {Object} data - context data;
 * @returns {void}
 */
const updateMenu = async data => {
  await initContextInfo();
  if (isObjectNotEmpty(data)) {
    const {contextInfo: info} = data;
    if (info) {
      const {content, isLink, selectionText, title, url} = info;
      const nodes = document.getElementsByClassName(SHARE_LINK);
      contextInfo.isLink = isLink;
      contextInfo.content = content;
      contextInfo.selectionText = selectionText;
      contextInfo.title = title;
      contextInfo.url = url;
      if (nodes && nodes.length) {
        for (const node of nodes) {
          const attr = "disabled";
          if (isLink) {
            node.removeAttribute(attr);
          } else {
            node.setAttribute(attr, attr);
          }
        }
      }
    }
  }
};

/**
 * request context info
 * @param {Object} tab - tabs.Tab
 * @returns {void}
 */
const requestContextInfo = async tab => {
  await initContextInfo();
  if (isObjectNotEmpty(tab)) {
    const {id} = tab;
    if (Number.isInteger(id) && id !== TAB_ID_NONE) {
      try {
        await sendMessage(id, {
          [CONTEXT_INFO_GET]: true,
        });
      } catch (e) {
        await updateMenu({
          contextInfo: {
            isLink: false,
            content: null,
            selectionText: null,
            title: null,
            url: null,
          },
        });
      }
    }
  }
};

/**
 * handle message
 * @param {*} msg - message
 * @returns {Promise.<Array>} - results of each handler
 */
const handleMsg = async msg => {
  const func = [];
  const items = msg && Object.entries(msg);
  if (items) {
    for (const item of items) {
      const [key, value] = item;
      switch (key) {
        case CONTEXT_INFO:
        case "keydown":
        case "mousedown":
          func.push(updateMenu(value));
          break;
        default:
      }
    }
  }
  return Promise.all(func);
};

/**
 * toggle warning message
 * @returns {void}
 */
const toggleWarning = async () => {
  const elm = document.getElementById(SNS_NOT_SELECTED);
  const items = document.getElementsByClassName(SNS_ITEM);
  if (elm && items && items.length) {
    let bool = false;
    for (const item of items) {
      bool = window.getComputedStyle(item).display !== "none";
      if (bool) {
        break;
      }
    }
    elm.style.display = bool && "none" || "block";
  }
};

/**
 * toggle SNS item
 * @param {string} id - item ID
 * @param {Object} obj - value object
 * @param {boolean} changed - changed
 * @returns {void}
 */
const toggleSnsItem = async (id, obj = {}) => {
  if (isString(id)) {
    const {checked} = obj;
    const elm = document.getElementById(id);
    if (elm) {
      elm.style.display = checked && "block" || "none";
    }
  }
};

/**
 * handle stored data
 * @param {Object} data - stored data
 * @returns {Promise.<Array>} - results of each handler
 */
const handleStoredData = async data => {
  const func = [];
  if (isObjectNotEmpty(data)) {
    const items = Object.entries(data);
    for (const item of items) {
      const [key, value] = item;
      if (isObjectNotEmpty(value)) {
        const {newValue} = value;
        sns.has(key) && func.push(toggleSnsItem(key, newValue || value));
      }
    }
  }
  return Promise.all(func);
};

/* listeners */
storage.onChanged.addListener(data =>
  handleStoredData(data).then(toggleWarning).catch(throwErr)
);
runtime.onMessage.addListener((msg, sender) =>
  handleMsg(msg, sender).catch(throwErr)
);

/* startup */
fetchSnsData().then(createHtml).then(() => Promise.all([
  localizeHtml(),
  addListenerToMenu(),
  getStorage().then(handleStoredData).then(toggleWarning),
  getActiveTab().then(tab => Promise.all([
    requestContextInfo(tab),
    setTabInfo(tab),
  ])),
])).catch(throwErr);
