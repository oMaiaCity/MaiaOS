<script>
    import { css } from 'styled-system/css';
    import { token } from 'styled-system/tokens';

    // Map the color palette from Panda config
    const colors = {
        Primary: ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'],
        Secondary: ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'],
        Accent: ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'],
        Slate: ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'],
        Success: ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'],
        Alert: ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'],
        Warning: ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'],
        Info: ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'],
    };

    // Brand 500s organized into 2 rows
    const brand500sRows = [
        ['Primary', 'Secondary', 'Accent', 'Slate'],  // Row 1: Brand colors + Slate
        ['Success', 'Warning', 'Alert', 'Info']      // Row 2: Semantic colors
    ];
</script>

<div class={css({ spaceY: '12' })}>
    <div class={css({ borderBottomWidth: '1px', borderColor: 'slate.200', pb: '6' })}>
        <h1 class={css({ fontFamily: 'title', fontSize: '4xl', mb: '2' })}>Colors</h1>
        <p>Core palette used across the Hominio application.</p>
    </div>

    <!-- Brand 500s Grid - 2 Rows -->
    <div class={css({ spaceY: '6' })}>
        <h2 class={css({ fontSize: 'xl', fontWeight: 'semibold' })}>Brand 500s</h2>
        {#each brand500sRows as row}
            <div class={css({ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '6' })}>
                {#each row as name}
                    <div class={css({ display: 'flex', flexDirection: 'column', gap: '2' })}>
                        <div 
                            class={css({ 
                                h: '32', 
                                w: 'full', 
                                rounded: 'card', 
                                shadow: 'md', 
                                display: 'flex', 
                                alignItems: 'flex-end', 
                                justifyContent: 'center', 
                                p: '4',
                                transition: 'transform 0.2s', 
                                _hover: { transform: 'scale(1.05)' }
                            })}
                            style="background-color: {token(`colors.${name.toLowerCase()}.500`)}"
                        >
                            <span class={css({ fontSize: 'sm', fontWeight: 'bold', color: name === 'Slate' ? 'slate.900' : 'white' })}>{name}</span>
                        </div>
                        <div class={css({ textAlign: 'center' })}>
                            <span class={css({ fontSize: 'xs' })}>500</span>
                        </div>
                    </div>
                {/each}
            </div>
        {/each}
    </div>

    {#each Object.entries(colors) as [name, shades]}
        <div class={css({ spaceY: '4' })}>
            <h2 class={css({ fontSize: 'xl', fontWeight: 'semibold' })}>{name}</h2>
            <div class={css({ gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', display: 'grid', gap: '4' })}>
                {#each shades as shade}
                    <div class={css({ display: 'flex', flexDirection: 'column', gap: '2' })}>
                        <div 
                            class={css({ 
                                h: '24', 
                                w: 'full', 
                                rounded: 'main', 
                                shadow: 'sm', 
                                display: 'flex', 
                                alignItems: 'flex-end', 
                                justifyContent: 'flex-start', 
                                p: '3', 
                                transition: 'transform 0.2s', 
                                cursor: 'pointer', 
                                _hover: { transform: 'scale(1.05)' },
                                group: true
                            })}
                            style="background-color: {token(`colors.${name.toLowerCase()}.${shade}`)}"
                        >
                            <span class={css({ 
                                fontSize: 'xs', 
                                fontWeight: 'medium', 
                                opacity: '0', 
                                transition: 'opacity 0.2s',
                                _groupHover: { opacity: '100' },
                                color: parseInt(shade) > 500 ? 'white' : 'slate.900'
                            })}>{shade}</span>
                        </div>
                        <div class={css({ display: 'flex', flexDirection: 'column', px: '1' })}>
                            <span class={css({ fontSize: 'xs', fontWeight: 'medium' })}>{shade}</span>
                            <span class={css({ fontSize: '[10px]', userSelect: 'all' })}>var(--colors-{name.toLowerCase()}-{shade})</span>
                        </div>
                    </div>
                {/each}
            </div>
        </div>
    {/each}
</div>

