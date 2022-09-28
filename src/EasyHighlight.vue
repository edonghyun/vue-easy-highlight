<script>
import { defineComponent, computed } from 'vue';
import HighlightedText from '@/components/common/HighlightedText';

export default defineComponent({
    name: 'EasyHighlight',
    components: {
        HighlightedText,
    },
    emits: ['text:selected', 'text:clicked'],
    props: {
        text: {
            type: String,
            required: true,
        },
        textsToHighlight: {
            type: Set,
            required: true,
        },
        higlightColor: {
            type: String,
            default: '#ddd6ff',
        },
    },
    setup(props, context) {
        const indexRangesToHighlight = computed(() => {
            const result = [];
            props.textsToHighlight.forEach((textToSearch) => {
                const escapedTextToSearch = textToSearch.replace(
                    /[.*+?^${}()|[\]\\]/g,
                    '\\$&',
                );

                const textIndices = [
                    ...props.text.matchAll(
                        new RegExp(escapedTextToSearch, 'gi'),
                    ),
                ].map((a) => a.index);

                textIndices.forEach((index) =>
                    result.push({
                        from: index,
                        to: index + textToSearch.length - 1,
                    }),
                );
            });
            return result;
        });

        function handleMouseUpEvent() {
            const selection = window.getSelection();
            const localSelectedText = selection.toString();
            const oRect = selection.getRangeAt(0).getBoundingClientRect();
            context.emit('text:selected', localSelectedText, oRect);
        }

        function handleClickEvent() {
            context.emit('text:clicked');
        }

        return {
            text: props.text,
            higlightColor: props.higlightColor,

            indexRangesToHighlight,

            handleMouseUpEvent,
            handleClickEvent,
        };
    },
});
</script>

<template>
    <div class="selectable-text">
        <div class="selcttions-wrapper">
            <div class="selectable-text-overlay">
                <HighlightedText
                    :text="text"
                    :indexRangesToHighlight="indexRangesToHighlight"
                    :baseColor="higlightColor"
                />
            </div>
        </div>
        <div>{{ text }}</div>
        <div
            class="display"
            @mouseup="handleMouseUpEvent"
            @click="handleClickEvent"
        >
            {{ text }}
        </div>
    </div>
</template>

<style lang="scss" scoped>
.selectable-text {
    position: relative;

    .display {
        z-index: 6;
        top: 0;
        position: absolute;
        color: transparent;
    }

    .selcttions-wrapper {
        top: 0;
        position: absolute;
        width: 100%;

        .selectable-text-overlay {
            top: 0;
            position: absolute;
            width: 100%;
        }
    }
}
</style>
