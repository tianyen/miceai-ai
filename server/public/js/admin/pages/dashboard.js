/**
 * Dashboard Page Scripts
 * 儀表板專用 JavaScript
 */

(function() {
    'use strict';

    // Dashboard Module
    const Dashboard = {
        refreshInterval: null,

        init() {
            this.loadStats();
            this.loadRecentProjects();
            this.loadRecentActivities();
            this.setupActionCards();
            this.startAutoRefresh();
        },

        loadStats() {
            $.ajax({
                url: '/api/admin/dashboard/stats',
                method: 'GET',
                success: (response) => {
                    if (response.success) {
                        this.renderStats(response.data);
                    }
                },
                error: () => {
                    this.renderStatsError();
                }
            });
        },

        renderStats(stats) {
            $('#total-projects').text(stats.totalProjects || 0);
            const projectsChange = stats.projectsThisMonth > 0
                ? '+' + stats.projectsThisMonth
                : (stats.projectsThisMonth || 0);
            $('#projects-change')
                .text(projectsChange)
                .addClass(stats.projectsThisMonth > 0 ? 'positive' : 'negative');

            $('#active-projects').text(stats.activeProjects || 0);
            const activeChange = stats.activeProjectsChange > 0
                ? '+' + stats.activeProjectsChange
                : (stats.activeProjectsChange || 0);
            $('#active-projects-change')
                .text(activeChange)
                .addClass(stats.activeProjectsChange > 0 ? 'positive' : 'negative');

            $('#total-users').text(stats.totalUsers || 0);
            const usersChange = stats.newUsersThisWeek > 0
                ? '+' + stats.newUsersThisWeek
                : (stats.newUsersThisWeek || 0);
            $('#users-change')
                .text(usersChange)
                .addClass(stats.newUsersThisWeek > 0 ? 'positive' : 'negative');
        },

        renderStatsError() {
            $('#total-projects').text('0');
            $('#projects-change').text('無資料');
            $('#active-projects').text('0');
            $('#active-projects-change').text('無資料');
            $('#total-users').text('0');
            $('#users-change').text('無資料');
        },

        loadRecentProjects() {
            $.ajax({
                url: '/api/admin/dashboard/recent-projects',
                method: 'GET',
                success: (response) => {
                    if (response.success) {
                        this.renderRecentProjects(response.data.projects || []);
                    }
                },
                error: () => {
                    $('#recent-projects').html('<p class="text-center text-muted">暫無項目記錄</p>');
                }
            });
        },

        renderRecentProjects(projects) {
            if (projects.length === 0) {
                $('#recent-projects').html('<p class="text-center text-muted">暫無項目記錄</p>');
                return;
            }

            let html = '';
            projects.forEach((project) => {
                // 狀態對應：draft=草稿, active=進行中, completed=已完成
                const statusMap = {
                    'draft': { class: 'warning', text: '草稿' },
                    'active': { class: 'success', text: '進行中' },
                    'completed': { class: 'primary', text: '已完成' }
                };
                const statusInfo = statusMap[project.status] || { class: 'secondary', text: project.status };
                html += `
                    <div class="project-item">
                        <div class="project-info">
                            <h4>
                                <span class="badge badge-secondary">#${project.id}</span>
                                ${project.project_name || project.name || 'unnamed'}
                            </h4>
                            <span class="badge badge-${statusInfo.class}">${statusInfo.text}</span>
                        </div>
                        <div class="project-date">${project.created_at}</div>
                    </div>
                `;
            });
            $('#recent-projects').html(html);
        },

        loadRecentActivities() {
            $.ajax({
                url: '/api/admin/dashboard/recent-activities',
                method: 'GET',
                success: (response) => {
                    if (response.success) {
                        this.renderRecentActivities(response.data.activities || []);
                    }
                },
                error: () => {
                    $('#recent-activities').html('<p class="text-center text-muted">暫無活動記錄</p>');
                }
            });
        },

        renderRecentActivities(activities) {
            if (activities.length === 0) {
                $('#recent-activities').html('<p class="text-center text-muted">暫無活動記錄</p>');
                return;
            }

            let html = '';
            activities.forEach((activity) => {
                html += `
                    <div class="activity-item">
                        <div class="activity-info">
                            <span class="activity-action">${activity.action}</span>
                            <span class="activity-user">by ${activity.user}</span>
                        </div>
                        <div class="activity-time">${activity.time}</div>
                    </div>
                `;
            });
            $('#recent-activities').html(html);
        },

        setupActionCards() {
            $('.action-card').on('click', function() {
                const action = $(this).data('action');

                switch (action) {
                    case 'new-project':
                        window.location.href = '/admin/projects';
                        break;
                    case 'new-template':
                        window.location.href = '/admin/templates';
                        break;
                    case 'new-user':
                        window.location.href = '/admin/users';
                        break;
                    case 'export-reports':
                        alert('匯出報告功能開發中...');
                        break;
                }
            });
        },

        startAutoRefresh() {
            // Refresh stats every 30 seconds
            this.refreshInterval = setInterval(() => {
                this.loadStats();
            }, 30000);
        },

        stopAutoRefresh() {
            if (this.refreshInterval) {
                clearInterval(this.refreshInterval);
                this.refreshInterval = null;
            }
        }
    };

    // Initialize when DOM is ready
    $(document).ready(function() {
        Dashboard.init();
    });

    // Cleanup on page unload
    $(window).on('beforeunload', function() {
        Dashboard.stopAutoRefresh();
    });

    // Expose for external access if needed
    window.Dashboard = Dashboard;
})();
