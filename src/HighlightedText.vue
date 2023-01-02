<script>
import { computed } from 'vue';
import { MAX_COLOR_DARKNESS, BASE_CHARACTER_ID } from './config';

function getDarkendColors(baseColor) {
    const colors = [baseColor];
    let color = Number(baseColor.replace('#', '0x'));
    for (let i = 0; i < MAX_COLOR_DARKNESS; i++) {
        color = color - 0x101010;
        if (color <= 0) {
            color = 0;
        }
        const stringifiedColor = color.toString(16);
        colors.push(
            stringifiedColor.length === 6 ? `#${stringifiedColor}` : '#000000',
        );
    }
    return colors;
}

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
        indexBaseColorMap: {
            type: Object,
            default: () => ({}),
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

        function getHighlightColor(index, selectedCount) {
            const highlightColors = getDarkendColors(
                props.indexBaseColorMap[index],
            );

            if (selectedCount === 0) {
                return 'transparent';
            }

            return selectedCount <= MAX_COLOR_DARKNESS
                ? highlightColors[selectedCount]
                : highlightColors[MAX_COLOR_DARKNESS];
        }

        function getId(index) {
            return `${BASE_CHARACTER_ID}${index}`;
        }

        return {
            isHighligted,
            isNewLine,
            getId,
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
        <div
            :class="[
                'easy-highlight-text-container',
                `${data.selectedCount > 0 ? 'highligted' : ''}`,
            ]"
            :style="selectionColors"
        >
            <div
                class="easy-highlight-text-highlight"
                :style="{
                    'background-color': getHighlightColor(
                        index,
                        data.selectedCount,
                    ),
                }"
            >
                &nbsp;
            </div>
            <span :id="getId(index)" class="text">{{ data.char }}</span>
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
