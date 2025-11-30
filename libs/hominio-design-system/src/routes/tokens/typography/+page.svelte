<script>
    import { css } from 'styled-system/css';
</script>

<div class={css({ spaceY: '12' })}>
    <div class={css({ borderBottomWidth: '1px', borderColor: 'light.200', pb: '6' })}>
        <h1 class={css({ fontFamily: 'title', fontSize: '4xl', mb: '2' })}>Typography</h1>
        <p>Font families and typographic styles.</p>
    </div>

    <div class={css({ spaceY: '12' })}>
        <!-- Title Font -->
        <div class={css({ spaceY: '4' })}>
            <h2 class={css({ fontSize: 'xl', fontWeight: 'semibold' })}>Title</h2>
            <code class={css({ fontSize: 'xs', bg: 'light.100', px: '2', py: '1', rounded: 'sm' })}>Shrikhand, cursive</code>
            
            <div class={css({ p: '6', borderWidth: '1px', borderColor: 'light.200', rounded: 'main', bg: 'white', spaceY: '4' })}>
                <h1 class={css({ fontFamily: 'title', fontSize: '4xl' })}>The quick brown fox jumps over the lazy dog.</h1>
                <h2 class={css({ fontFamily: 'title', fontSize: '2xl' })}>The quick brown fox jumps over the lazy dog.</h2>
                <h3 class={css({ fontFamily: 'title', fontSize: 'base' })}>The quick brown fox jumps over the lazy dog.</h3>
            </div>
        </div>

        <!-- Text Font -->
        <div class={css({ spaceY: '4' })}>
            <h2 class={css({ fontSize: 'xl', fontWeight: 'semibold' })}>Text</h2>
            <code class={css({ fontSize: 'xs', bg: 'light.100', px: '2', py: '1', rounded: 'sm' })}>Inter, system-ui, sans-serif</code>
            
            <div class={css({ p: '6', borderWidth: '1px', borderColor: 'light.200', rounded: 'main', bg: 'white', spaceY: '4' })}>
                <p class={css({ fontFamily: 'sans', fontSize: '4xl' })}>The quick brown fox jumps over the lazy dog.</p>
                <p class={css({ fontFamily: 'sans', fontSize: '2xl' })}>The quick brown fox jumps over the lazy dog.</p>
                <p class={css({ fontFamily: 'sans', fontSize: 'base' })}>The quick brown fox jumps over the lazy dog.</p>
            </div>
        </div>
    </div>
</div>
