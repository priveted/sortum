# Sortum

[![npm version](https://img.shields.io/npm/v/sortum.svg)](https://www.npmjs.com/package/sortum)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Lightweight, powerful drag-and-drop sorting library with touch support, smooth animations, and cross-container functionality.

---

## Website

[Website](https://sortum.priveted.com) /
[Documentation](https://sortum.priveted.com/#docs) /
[Examples](https://sortum.priveted.com/#examples)

## Installation

```bash
npm i sortum
```

## Quick Start

```html
<div class="sortum">
  <div class="item">Item 1</div>
  <div class="item">Item 2</div>
  <div class="item">Item 3</div>
</div>
```

```js
import Sortum from 'sortum';

const sortum = new Sortum(document.querySelector('.sortum'), {
  duration: 300,
  onEnd: (data) => {
    console.log(`Moved from ${data.fromIndex} to ${data.toIndex}`);
  },
});
```

---

## License

[MIT](https://opensource.org/licenses/MIT)
