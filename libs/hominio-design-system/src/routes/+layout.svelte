<script>
    import '../app.css';
    import '../lib/styles/fonts.css';
    import { page } from '$app/stores';
    import { css, cx } from 'styled-system/css';

    // Define navigation items
    const menuItems = [
        {
            category: 'Tokens',
            items: [
                { name: 'Colors', href: '/tokens/colors' },
                { name: 'Typography', href: '/tokens/typography' }
            ]
        },
        {
            category: 'Leafs',
            items: [
                { name: 'Badge', href: '/leafs/badge' },
                { name: 'Button', href: '/leafs/button' },
                { name: 'Call Button', href: '/leafs/call-button' },
                { name: 'Card', href: '/leafs/card' },
                { name: 'Glass Icon Button', href: '/leafs/glass-icon-button' },
                { name: 'Label', href: '/leafs/label' },
                { name: 'Profile Avatar', href: '/leafs/profile-avatar' },
                { name: 'Iconify Icons', href: '/leafs/iconify-icons' }
            ]
        },
        {
            category: 'Compositions',
            items: [
                { name: 'Nav Pill', href: '/compositions/nav-pill' }
            ]
        },
        {
            category: 'Views',
            items: [
                { name: 'todo-view', href: '/todo-app' }
            ]
        }
    ];

    const containerStyle = css({
        display: 'flex',
        h: '100vh',
        bg: 'slate.50',
        overflow: 'hidden',
        fontFamily: 'sans'
        // Color inherits from global body typography (primary.500)
    });

    const sidebarStyle = css({
        w: '64',
        bg: 'white',
        borderRightWidth: '1px',
        borderColor: 'slate.200',
        display: 'flex',
        flexDirection: 'column'
    });

    const sidebarHeader = css({
        p: '6',
        borderBottomWidth: '1px',
        borderColor: 'slate.100'
    });

    const sidebarNav = css({
        flex: '1',
        overflowY: 'auto',
        py: '4',
        px: '3',
        spaceY: '6'
    });
    
    const categoryTitle = css({
        px: '3',
        fontSize: 'xs',
        fontWeight: 'semibold',
        textTransform: 'uppercase',
        letterSpacing: 'wider',
        mb: '2'
        // Color inherits from global typography (primary.500)
    });

    const linkBase = css({
        display: 'flex',
        alignItems: 'center',
        px: '3',
        py: '2',
        fontSize: 'sm',
        fontWeight: 'medium',
        rounded: 'full', // Fully rounded
        transition: 'colors 150ms'
    });

    const activeLink = css({
        bg: 'primary.500',
        color: 'primary.50'
    });

    const inactiveLink = css({
        // Color inherits from global typography (primary.500)
        _hover: { bg: 'accent.500', color: 'accent.900' }
    });
</script>

<div class={containerStyle}>
    <!-- Sidebar -->
    <aside class={sidebarStyle}>
        <div class={sidebarHeader}>
            <h1 class={css({ fontFamily: 'title', fontSize: '2xl' })}>
                Hominio <span class={css({ color: 'secondary.500' })}>DS</span>
            </h1>
            <p class={css({ fontSize: 'xs', mt: '1' })}>Design System Catalog</p>
        </div>

        <nav class={sidebarNav}>
            {#each menuItems as section}
                <div>
                    <h3 class={categoryTitle}>
                        {section.category}
                    </h3>
                    <ul class={css({ spaceY: '1' })}>
                        {#each section.items as item}
                            <li>
                                <a 
                                    href={item.href}
                                    class={cx(linkBase, $page.url.pathname === item.href ? activeLink : inactiveLink)}
                                >
                                    {item.name}
                                </a>
                            </li>
                        {/each}
                    </ul>
                </div>
            {/each}
        </nav>

        <div class={css({ p: '4', borderTopWidth: '1px', borderColor: 'slate.100', fontSize: 'xs', textAlign: 'center' })}>
            v0.0.1
        </div>
    </aside>

    <!-- Main Content -->
    <main class={css({ flex: '1', overflowY: 'auto', position: 'relative', bg: 'slate.50' })}>
        <div class={css({ position: 'relative', zIndex: '10', p: '8', maxWidth: '7xl', mx: 'auto' })}>
            <slot />
        </div>
    </main>
</div>
