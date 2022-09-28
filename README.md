# vue-easy-highlight

vue-easy-highlight is for displaying texts with easily hilightable functionality. 

## Installation
```vue
<template>
    <HighlightableText
        :text="text"
        :textsToHighlight="textsToHighlight"
        :higlightColor="higlightColor"
    />
</template>

<script setup>
import { computed, defineProps } from 'vue';
import HighlightableText from 'vue-easy-highlight';

const text = '''
    Lorem Ipsum is simply dummy text of the printing and typesetting industry. 
    Lorem Ipsum has been the industrys standard dummy text ever since the 1500s, 
    when an unknown printer took a galley of type and scrambled it to make a type specimen book.
     It has survived not only five centuries, but also the leap into electronic typesetting, 
     remaining essentially unchanged. It was popularised in the 1960s with the release 
     of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop 
     publishing software like Aldus PageMaker including versions of Lorem Ipsum.
''';

const higlightColor = '#87cefa';

const textsToHighlight = 'unknown printer took a galley of type and scrambled it to make a type specimen ';

const props = defineProps([
    'text',
    'textsToHighlight',
    'higlightColor',
]);
</script>
```

### Usage
```
npm run serve
```

### Props
|Property|Type|Required|Description|
|--------|----|--------|-----------|
|text|String|✓|Original text.|
|textsToHighlight|Set|✓|Texts to highlight within given original text.|
|higlightColor|String||Color in hex to highlight. default value is '#ddd6ff'|

### License
MIT License - fork, modify and use freely as much as you want.
