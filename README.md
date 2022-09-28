# vue-easy-highlight

vue-easy-highlight is for displaying texts with easily hilightable functionality. 

## Installation
```
npm install --save vue-easy-highlight
```

### Running Demo 
```
npm run serve demo/src/main.js
```

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
