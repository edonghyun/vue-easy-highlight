<script>
import { defineComponent, computed } from 'vue';

const MAX_COLOR_DARKNESS = 10;

function getDarkendColors(colorCode) {
    const colors = [colorCode, colorCode];
    let color = Number(colorCode.replace('#', '0x'));
    for (let i = 0; i < MAX_COLOR_DARKNESS; i++) {
        color = color = color - 0x101010;
        colors.push(`#${color.toString(16)}`);
    }
    return colors;
}

export default defineComponent({
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
        baseHighlighColor: {
            type: String,
            default: () => '#d9fbd5',
        },
        highlightColors: {
            type: Array,
            default: () => [],
        },
    },
    setup(props) {
        const colors = computed(() =>
            props.highlightColors.length > 0
                ? props.highlightColors
                : getDarkendColors(props.baseHighlighColor),
        );

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

            const charArray = props.text.split('').map((char) => ({
                char,
                selectedCount: 0,
            }));

            let accumulator = 0;
            sweeper.forEach((e, index) => {
                accumulator = accumulator + e;
                charArray[index].selectedCount = accumulator;
            });

            return charArray;
        });

        function isHighligted(index) {
            return textData.value[index]?.selectedCount > 0;
        }

        function getHighlightColor(selectedCount) {
            return selectedCount <= MAX_COLOR_DARKNESS
                ? colors.value[selectedCount]
                : colors.value[MAX_COLOR_DARKNESS];
        }

        return {
            colors,
            isHighligted,
            getHighlightColor,
            textData,
        };
    },
});
</script>

<template>
    <div
        v-for="(data, index) in textData"
        :key="index"
        class="active-sentence-text-container"
    >
        <span class="text">{{ data.char }}</span>
        <svg
            v-if="data.selectedCount > 0"
            :stroke="getHighlightColor(data.selectedCount)"
            class="hightlight"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 400 60"
            preserveAspectRatio="none"
        >
            <path
                pathLength="400"
                d="m 3.518915,27.827324 c 55.429038,4.081 111.581115,5.822 167.117815,2.867 22.70911,-1.208 45.39827,-0.601 68.126,-0.778 28.38172,-0.223 56.76078,-1.024 85.13721,-1.33 24.17378,-0.261 48.4273,0.571 72.58114,0.571"
            />
        </svg>
    </div>
</template>

<style lang="scss" scoped>
.active-sentence-text-container {
    position: relative;
    display: inline-flex;
    background: none;
    margin: 0;
    padding: 0;

    span.text {
        white-space: pre;
        position: relative;
        z-index: 2;
    }

    svg {
        position: absolute;
        top: -10%;
        left: -10%;
        right: -10%;
        bottom: -10%;
        width: 100%;
        height: 100%;
        overflow: hidden;
        margin: auto;
        padding: 0;
        fill: none;

        &.hightlight {
            z-index: 0;
            opacity: 0.4;
            stroke-width: 54px;
            stroke-dasharray: 400;
            stroke-dashoffset: 0;
            mix-blend-mode: multiply;
            animation: drawing 0.1s linear;

            @keyframes drawing {
                0% {
                    stroke-dashoffset: 400;
                }
                100% {
                    stroke-dashoffset: 0;
                }
            }
        }
    }
}
</style>
