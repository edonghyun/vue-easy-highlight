# vue-easy-highlight

vue-easy-highlight is for displaying texts with easily hilightable functionality. 

## Installation
```
npm install --save vue-easy-highlight
```

### Running Demo 
```sh
npm ci
npm run serve
```

The scripts use `demo/src/main.js` as the application entry. To build the demo into `dist/`:

```sh
npm run build
```

### Current verification and limits

- Checked the demo install and production build with Node.js 22.22.0 and npm 10.9.4, then opened the built demo in Chromium.
- The demo build is checked by [GitHub CI](https://github.com/edonghyun/vue-easy-highlight/actions/workflows/demo-build.yml). This builds the example app; it does not create a distributable library bundle or verify an npm release.
- The existing multiline demo can display highlights out of alignment with the visible phrase. This remains a known issue; rendering a highlight does not establish correct alignment under wrapping and whitespace changes.
- The public prop name remains `higlightColor`, including its original spelling. Selection-event edge cases have not been verified in this cleanup.

이번 정리는 실행 경로와 빌드 재현을 보완한 것입니다. 컴포넌트의 줄바꿈·공백 정렬 문제는 후속 수정 대상으로 남아 있습니다.

### Usage
```vue
<template>
    <HighlightableText
        :text="text"
        :textsToHighlight="textsToHighlight"
        :higlightColor="higlightColor"
    />
</template>

<script>
import { defineComponent } from 'vue';
import HighlightableText from '../../src/EasyHighlight.vue';

export default defineComponent({
    name: 'App',
    components: {
        HighlightableText,
    },
    setup() {
        const text = `
            Lorem Ipsum is simply dummy text of the printing 
            and typesetting industry.
            Lorem Ipsum has been the industrys standard dummy 
            text ever since the 1500s,
            when an unknown printer took a galley of type and 
            scrambled it to make a type specimen book.
            It has survived not only five centuries, but also 
            the leap into electronic typesetting,
            remaining essentially unchanged. It was popularised 
            in the 1960s with the release
            of Letraset sheets containing Lorem Ipsum passages, 
            and more recently with desktop
            publishing software like Aldus PageMaker including 
            versions of Lorem Ipsum.
        `;

        const higlightColor = '#87cefa';

        const textsToHighlight = new Set(['unknown printer took a galley']);

        return {
            text,
            higlightColor,
            textsToHighlight,
        };
    },
});
</script>

```

### Props
|Property|Type|Required|Description|
|--------|----|--------|-----------|
|text|String|✓|Original text.|
|textsToHighlight|Set|✓|Texts to highlight within given original text.|
|higlightColor|String||Color in hex to highlight. default value is '#ddd6ff'|

### License
MIT License - fork, modify and use freely as much as you want.
