<script>
import { computed } from 'vue';
import { MAX_COLOR_DARKNESS } from './config';

export default {
    name: 'HighlightedText',
    props: {
        text: {
            type: String,
            required: true,
        },
        indexRangesToHighlight: {
            type: Array,
            default: () => [],
        },
        highlightColors: {
            type: Array,
            default: () => [],
        },
        selectionColors: {
            type: Object,
            default: () => ({}),
        },
    },
    setup(props) {
        const textData = computed(() => {
            const sweeper = [];
            for (let i = 0; i < props.text.length; i++) {
                sweeper.push(0);
            }

            props.indexRangesToHighlight.forEach(({ from, to }) => {
                sweeper[from] += 1;
                if (to + 1 < props.text.length) {
                    sweeper[to + 1] -= 1;
                }
            });

            const characters = props.text.split('').map((char) => ({
                char,
                selectedCount: 0,
            }));

            let accumulator = 0;
            sweeper.forEach((e, index) => {
                accumulator = accumulator + e;
                characters[index].selectedCount = accumulator;
            });

            return characters;
        });

        function isHighligted(index) {
            return textData.value[index]?.selectedCount > 0;
        }

        function isNewLine(charcter) {
            return charcter === '\n';
        }

        function getClasses(character) {
            return isNewLine(character)
                ? 'easy-highlight-active-sentence-text-container easy-highlihgt-new-line'
                : 'easy-highlight-active-sentence-text-container';
        }

        function getHighlightColor(selectedCount) {
            return selectedCount <= MAX_COLOR_DARKNESS
                ? props.highlightColors[selectedCount]
                : props.highlightColors[MAX_COLOR_DARKNESS];
        }

        return {
            isHighligted,
            isNewLine,
            getHighlightColor,
            getClasses,
            textData,
        };
    },
};
</script>

<template>
    <div
        v-for="(data, index) in textData"
        :id="index + 1"
        :key="index"
        :class="getClasses(data.char)"
    >
        <div class="easy-highlight-text-container" :style="selectionColors">
            <div
                class="easy-highlight-text-highlight"
                :style="{
                    'background-color':
                        data.selectedCount > 0 &&
                        getHighlightColor(data.selectedCount),
                }"
            >
                &nbsp;
            </div>
            <span class="text">{{ data.char }}</span>
        </div>
    </div>
</template>

<style lang="scss">
.easy-highlight-active-sentence-text-container {
    position: relative;
    display: inline-flex;
    background: none;
    margin: 0;
    padding: 0;

    &.easy-highlihgt-new-line {
        display: inline;
    }

    .easy-highlight-text-container {
        width: 100%;
        position: relative;

        .easy-highlight-text-highlight {
            padding: 2px 5px 2px 5px;
            position: absolute;
            width: 100%;
            transform: rotate(10deg);
            top: -1px;
            left: -1px;
            border-radius: 20% 5% 15% 5%;

            &::selection {
                background: transparent;
            }
        }

        span.text {
            white-space: pre;
            position: relative;
            z-index: 2;

            &::selection {
                color: var(--selected-color);
                background-color: var(--selected-background-color);
            }
        }
    }
}
</style>
