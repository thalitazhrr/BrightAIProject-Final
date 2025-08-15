// src/models/telkomOrderModel.js
const { query } = require('../config/database');

class TelkomOrderModel {
  
  // Create table with proper schema (sesuai dengan import script)
  static async createTable() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS telkom_orders (
        id SERIAL PRIMARY KEY,
        order_id VARCHAR(100),
        regional VARCHAR(100),
        witel VARCHAR(100),
        datel VARCHAR(100),
        sto VARCHAR(100),
        extern_order_id VARCHAR(100),
        jenispsb VARCHAR(50),
        type_trans VARCHAR(50),
        status_resume VARCHAR(100),
        status_message TEXT,
        kcontact VARCHAR(100),
        order_date DATE,
        ncli VARCHAR(50),
        ndem VARCHAR(50),
        speedy VARCHAR(50),
        pots VARCHAR(50),
        customer_name VARCHAR(255),
        contact_hp VARCHAR(50),
        contact_email VARCHAR(255),
        ins_address TEXT,
        customer_addr TEXT,
        city_name VARCHAR(100),
        gps_latitude DECIMAL(10, 8),
        gps_longitude DECIMAL(11, 8),
        package_name VARCHAR(255),
        loc_id VARCHAR(100),
        device_id VARCHAR(100),
        agent_id VARCHAR(100),
        wfm_id VARCHAR(100),
        wfm_status VARCHAR(100),
        wfm_task VARCHAR(255),
        wfm_task_status VARCHAR(100),
        crew_id VARCHAR(100),
        tech_id_1 VARCHAR(100),
        tech_name_1 VARCHAR(255),
        tech_id_2 VARCHAR(100),
        tech_name_2 VARCHAR(255),
        last_updated_date TIMESTAMP,
        type_layanan VARCHAR(100),
        isi_comment TEXT,
        tindak_lanjut TEXT,
        user_id_tl VARCHAR(100),
        tl_date DATE,
        tgl_proses DATE,
        tgl_manja DATE,
        hide BOOLEAN DEFAULT FALSE,
        category VARCHAR(100),
        provider VARCHAR(100),
        tgl_ps DATE,
        wonum VARCHAR(100),
        detail_manja TEXT,
        lat_alpro DECIMAL(10, 8),
        long_alpro DECIMAL(11, 8),
        paket VARCHAR(255),
        channel VARCHAR(100),
        kat_hvc VARCHAR(100),
        per_hvc VARCHAR(100),
        ldtext TEXT,
        errorcode VARCHAR(100),
        flag_deposit BOOLEAN DEFAULT FALSE,
        cluster_id VARCHAR(100),
        product VARCHAR(255),
        tgl_created_wo DATE,
        order_id_old VARCHAR(100),
        customer_addr_new TEXT,
        desc_paket TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Create indexes for better performance
      CREATE INDEX IF NOT EXISTS idx_regional ON telkom_orders(regional);
      CREATE INDEX IF NOT EXISTS idx_witel ON telkom_orders(witel);
      CREATE INDEX IF NOT EXISTS idx_order_date ON telkom_orders(order_date);
      CREATE INDEX IF NOT EXISTS idx_status_resume ON telkom_orders(status_resume);
      CREATE INDEX IF NOT EXISTS idx_package_name ON telkom_orders(package_name);
      CREATE INDEX IF NOT EXISTS idx_city_name ON telkom_orders(city_name);
    `;

    try {
      await query(createTableQuery);
      console.log('✅ Telkom orders table created successfully');
    } catch (error) {
      console.error('❌ Error creating table:', error);
      throw error;
    }
  }

  // Get overall statistics with new HSI Business Metrics
  async getOverallStats() {
    try {
      const result = await query(`
        SELECT 
          COUNT(*) as total_orders,
          COUNT(DISTINCT regional) as total_regions,
          COUNT(DISTINCT witel) as total_witels,
          COUNT(DISTINCT datel) as total_datels,
          COUNT(DISTINCT city_name) as total_cities,
          COUNT(CASE WHEN status_resume IN ('COMPLETED', 'SUCCESS', 'SELESAI') THEN 1 END) as completed_orders,
          COUNT(CASE WHEN status_resume IN ('PENDING', 'WAITING', 'PROGRESS') THEN 1 END) as pending_orders,
          COUNT(CASE WHEN status_resume IN ('FAILED', 'CANCEL', 'GAGAL') THEN 1 END) as failed_orders,
          COUNT(CASE WHEN jenispsb = 'AO' THEN 1 END) as activation_orders,
          COUNT(CASE WHEN jenispsb = 'DO' THEN 1 END) as disconnect_orders,
          COUNT(CASE WHEN jenispsb = 'MO' THEN 1 END) as modification_orders,
          COUNT(CASE WHEN jenispsb = 'AS' THEN 1 END) as add_service_orders,
          COUNT(CASE WHEN jenispsb = 'CT0' THEN 1 END) as cancellation_orders,
          ROUND(
            COUNT(CASE WHEN status_resume IN ('COMPLETED', 'SUCCESS', 'SELESAI') THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 2
          ) as completion_rate,
          -- Churn to Sales Ratio
          ROUND(
            COUNT(CASE WHEN jenispsb = 'DO' THEN 1 END) * 100.0 / 
            NULLIF(COUNT(CASE WHEN jenispsb = 'AO' THEN 1 END), 0), 2
          ) as churn_to_sales_ratio,
          -- CT0 to Sales Ratio
          ROUND(
            COUNT(CASE WHEN jenispsb = 'CT0' THEN 1 END) * 100.0 / 
            NULLIF(COUNT(CASE WHEN jenispsb = 'AO' THEN 1 END), 0), 2
          ) as ct0_to_sales_ratio,
          -- Average Processing Time (in days)
          ROUND(
            AVG(EXTRACT(DAY FROM (last_updated_date - order_date))), 2
          ) as avg_processing_days,
          -- Orders with processing time > 3 days
          COUNT(CASE WHEN EXTRACT(DAY FROM (last_updated_date - order_date)) > 3 THEN 1 END) as slow_processing_orders
        FROM telkom_orders
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      `);

      const stats = result.rows[0];
      return {
        totalOrders: parseInt(stats.total_orders),
        totalRegions: parseInt(stats.total_regions),
        totalWitels: parseInt(stats.total_witels),
        totalDatels: parseInt(stats.total_datels),
        totalCities: parseInt(stats.total_cities),
        completedOrders: parseInt(stats.completed_orders),
        pendingOrders: parseInt(stats.pending_orders),
        failedOrders: parseInt(stats.failed_orders),
        activationOrders: parseInt(stats.activation_orders),
        disconnectOrders: parseInt(stats.disconnect_orders),
        modificationOrders: parseInt(stats.modification_orders),
        addServiceOrders: parseInt(stats.add_service_orders),
        cancellationOrders: parseInt(stats.cancellation_orders),
        completionRate: parseFloat(stats.completion_rate),
        churnToSalesRatio: parseFloat(stats.churn_to_sales_ratio) || 0,
        ct0ToSalesRatio: parseFloat(stats.ct0_to_sales_ratio) || 0,
        avgProcessingDays: parseFloat(stats.avg_processing_days) || 0,
        slowProcessingOrders: parseInt(stats.slow_processing_orders),
        // Calculate achievement vs target (assuming target 85% completion)
        achievementPercentage: Math.min(100, (parseFloat(stats.completion_rate) / 85) * 100),
        // Daily sales velocity (orders per day)
        dailySalesVelocity: Math.round(parseInt(stats.total_orders) / 30)
      };
    } catch (error) {
      console.error('❌ Error getting overall stats:', error);
      throw error;
    }
  }

  // Get quick stats for general responses
  async getQuickStats() {
    try {
      const result = await query(`
        SELECT 
          COUNT(*) as total_orders,
          COUNT(DISTINCT regional) as total_regions,
          ROUND(
            COUNT(CASE WHEN status_resume IN ('COMPLETED', 'SUCCESS', 'SELESAI') THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 1
          ) as completion_rate
        FROM telkom_orders
      `);

      const stats = result.rows[0];
      return {
        totalOrders: parseInt(stats.total_orders),
        totalRegions: parseInt(stats.total_regions),
        completionRate: parseFloat(stats.completion_rate)
      };
    } catch (error) {
      console.error('❌ Error getting quick stats:', error);
      throw error;
    }
  }

  // Get top regions by order count
  async getTopRegions(limit = 10) {
    try {
      const result = await query(`
        SELECT 
          regional,
          COUNT(*) as order_count,
          COUNT(CASE WHEN status_resume IN ('COMPLETED', 'SUCCESS', 'SELESAI') THEN 1 END) as completed_count,
          ROUND(
            COUNT(CASE WHEN status_resume IN ('COMPLETED', 'SUCCESS', 'SELESAI') THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 1
          ) as completion_rate
        FROM telkom_orders 
        WHERE regional IS NOT NULL
        GROUP BY regional 
        ORDER BY order_count DESC 
        LIMIT $1
      `, [limit]);

      return result.rows.map(row => ({
        regional: row.regional,
        order_count: parseInt(row.order_count),
        completed_count: parseInt(row.completed_count),
        completion_rate: parseFloat(row.completion_rate)
      }));
    } catch (error) {
      console.error('❌ Error getting top regions:', error);
      throw error;
    }
  }

  // Get regional breakdown with HSI Business Metrics
  async getRegionalBreakdown() {
    try {
      const result = await query(`
        SELECT 
          regional,
          COUNT(*) as total_orders,
          COUNT(DISTINCT witel) as witel_count,
          COUNT(DISTINCT datel) as datel_count,
          COUNT(DISTINCT city_name) as city_count,
          COUNT(CASE WHEN jenispsb = 'AO' THEN 1 END) as activation_orders,
          COUNT(CASE WHEN jenispsb = 'DO' THEN 1 END) as disconnect_orders,
          COUNT(CASE WHEN jenispsb = 'CT0' THEN 1 END) as cancellation_orders,
          ROUND(
            COUNT(CASE WHEN status_resume IN ('COMPLETED', 'SUCCESS', 'SELESAI') THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 1
          ) as completion_rate,
          ROUND(
            COUNT(CASE WHEN jenispsb = 'DO' THEN 1 END) * 100.0 / 
            NULLIF(COUNT(CASE WHEN jenispsb = 'AO' THEN 1 END), 0), 1
          ) as churn_to_sales_ratio,
          ROUND(
            COUNT(CASE WHEN jenispsb = 'CT0' THEN 1 END) * 100.0 / 
            NULLIF(COUNT(CASE WHEN jenispsb = 'AO' THEN 1 END), 0), 1
          ) as ct0_to_sales_ratio,
          ROUND(
            AVG(EXTRACT(DAY FROM (last_updated_date - order_date))), 1
          ) as avg_processing_days,
          COUNT(CASE WHEN order_date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as recent_orders,
          -- Calculate achievement vs target (85% completion)
          ROUND(
            (COUNT(CASE WHEN status_resume IN ('COMPLETED', 'SUCCESS', 'SELESAI') THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0)) / 85 * 100, 1
          ) as achievement_percentage
        FROM telkom_orders 
        WHERE regional IS NOT NULL
        GROUP BY regional 
        ORDER BY total_orders DESC
      `);

      return result.rows.map(row => ({
        regional: row.regional,
        total_orders: parseInt(row.total_orders),
        witel_count: parseInt(row.witel_count),
        datel_count: parseInt(row.datel_count),
        city_count: parseInt(row.city_count),
        activation_orders: parseInt(row.activation_orders),
        disconnect_orders: parseInt(row.disconnect_orders),
        cancellation_orders: parseInt(row.cancellation_orders),
        completion_rate: parseFloat(row.completion_rate),
        churn_to_sales_ratio: parseFloat(row.churn_to_sales_ratio) || 0,
        ct0_to_sales_ratio: parseFloat(row.ct0_to_sales_ratio) || 0,
        avg_processing_days: parseFloat(row.avg_processing_days) || 0,
        recent_orders: parseInt(row.recent_orders),
        achievement_percentage: parseFloat(row.achievement_percentage) || 0
      }));
    } catch (error) {
      console.error('❌ Error getting regional breakdown:', error);
      throw error;
    }
  }

  // Get specific region details
  async getRegionDetails(regionalName) {
    try {
      const regionResult = await query(`
        SELECT 
          regional,
          COUNT(*) as total_orders,
          COUNT(DISTINCT witel) as witel_count,
          COUNT(DISTINCT city_name) as city_count,
          ROUND(
            COUNT(CASE WHEN status_resume IN ('COMPLETED', 'SUCCESS', 'SELESAI') THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 1
          ) as completion_rate
        FROM telkom_orders 
        WHERE UPPER(regional) = UPPER($1)
        GROUP BY regional
      `, [regionalName]);

      if (regionResult.rows.length === 0) return null;

      const topWitels = await query(`
        SELECT witel, COUNT(*) as order_count
        FROM telkom_orders 
        WHERE UPPER(regional) = UPPER($1) AND witel IS NOT NULL
        GROUP BY witel 
        ORDER BY order_count DESC 
        LIMIT 5
      `, [regionalName]);

      const topPackages = await query(`
        SELECT package_name, COUNT(*) as order_count
        FROM telkom_orders 
        WHERE UPPER(regional) = UPPER($1) AND package_name IS NOT NULL
        GROUP BY package_name 
        ORDER BY order_count DESC 
        LIMIT 5
      `, [regionalName]);

      return {
        ...regionResult.rows[0],
        total_orders: parseInt(regionResult.rows[0].total_orders),
        witel_count: parseInt(regionResult.rows[0].witel_count),
        city_count: parseInt(regionResult.rows[0].city_count),
        completion_rate: parseFloat(regionResult.rows[0].completion_rate),
        top_witels: topWitels.rows.map(w => ({
          witel: w.witel,
          order_count: parseInt(w.order_count)
        })),
        top_packages: topPackages.rows.map(p => ({
          package_name: p.package_name,
          order_count: parseInt(p.order_count)
        }))
      };
    } catch (error) {
      console.error('❌ Error getting region details:', error);
      throw error;
    }
  }

  // Get witel breakdown with HSI Business Metrics
  async getWitelBreakdown() {
    try {
      const result = await query(`
        SELECT 
          witel,
          regional,
          COUNT(*) as total_orders,
          COUNT(DISTINCT datel) as datel_count,
          COUNT(DISTINCT city_name) as city_count,
          COUNT(CASE WHEN jenispsb = 'AO' THEN 1 END) as activation_orders,
          COUNT(CASE WHEN jenispsb = 'DO' THEN 1 END) as disconnect_orders,
          COUNT(CASE WHEN jenispsb = 'CT0' THEN 1 END) as cancellation_orders,
          ROUND(
            COUNT(CASE WHEN status_resume IN ('COMPLETED', 'SUCCESS', 'SELESAI') THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 1
          ) as completion_rate,
          ROUND(
            COUNT(CASE WHEN jenispsb = 'DO' THEN 1 END) * 100.0 / 
            NULLIF(COUNT(CASE WHEN jenispsb = 'AO' THEN 1 END), 0), 1
          ) as churn_to_sales_ratio,
          ROUND(
            COUNT(CASE WHEN jenispsb = 'CT0' THEN 1 END) * 100.0 / 
            NULLIF(COUNT(CASE WHEN jenispsb = 'AO' THEN 1 END), 0), 1
          ) as ct0_to_sales_ratio,
          ROUND(
            AVG(EXTRACT(DAY FROM (last_updated_date - order_date))), 1
          ) as avg_processing_days,
          -- Daily sales velocity
          ROUND(COUNT(*) / 30.0, 1) as daily_sales_velocity,
          -- Achievement vs target
          ROUND(
            (COUNT(CASE WHEN status_resume IN ('COMPLETED', 'SUCCESS', 'SELESAI') THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0)) / 85 * 100, 1
          ) as achievement_percentage
        FROM telkom_orders 
        WHERE witel IS NOT NULL
        GROUP BY witel, regional 
        ORDER BY total_orders DESC
      `);

      return result.rows.map(row => ({
        witel: row.witel,
        regional: row.regional,
        total_orders: parseInt(row.total_orders),
        datel_count: parseInt(row.datel_count),
        city_count: parseInt(row.city_count),
        activation_orders: parseInt(row.activation_orders),
        disconnect_orders: parseInt(row.disconnect_orders),
        cancellation_orders: parseInt(row.cancellation_orders),
        completion_rate: parseFloat(row.completion_rate),
        churn_to_sales_ratio: parseFloat(row.churn_to_sales_ratio) || 0,
        ct0_to_sales_ratio: parseFloat(row.ct0_to_sales_ratio) || 0,
        avg_processing_days: parseFloat(row.avg_processing_days) || 0,
        daily_sales_velocity: parseFloat(row.daily_sales_velocity) || 0,
        achievement_percentage: parseFloat(row.achievement_percentage) || 0
      }));
    } catch (error) {
      console.error('❌ Error getting witel breakdown:', error);
      throw error;
    }
  }

  // Get package breakdown
  async getPackageBreakdown() {
    try {
      const result = await query(`
        SELECT 
          COALESCE(package_name, 'Unknown Package') as package_name,
          COUNT(*) as order_count,
          ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM telkom_orders), 2) as percentage,
          ROUND(
            COUNT(CASE WHEN status_resume IN ('COMPLETED', 'SUCCESS', 'SELESAI') THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 1
          ) as success_rate,
          -- Estimated price based on package name patterns
          CASE 
            WHEN UPPER(package_name) LIKE '%PREMIUM%' OR UPPER(package_name) LIKE '%PRO%' THEN 500000
            WHEN UPPER(package_name) LIKE '%BUSINESS%' OR UPPER(package_name) LIKE '%CORPORATE%' THEN 750000
            WHEN UPPER(package_name) LIKE '%BASIC%' OR UPPER(package_name) LIKE '%HOME%' THEN 300000
            WHEN UPPER(package_name) LIKE '%FIBER%' THEN 400000
            ELSE 350000
          END as estimated_price
        FROM telkom_orders 
        GROUP BY package_name 
        ORDER BY order_count DESC
      `);

      return result.rows.map(row => ({
        package_name: row.package_name,
        order_count: parseInt(row.order_count),
        percentage: parseFloat(row.percentage),
        success_rate: parseFloat(row.success_rate),
        estimated_price: parseInt(row.estimated_price)
      }));
    } catch (error) {
      console.error('❌ Error getting package breakdown:', error);
      throw error;
    }
  }

  // Get status breakdown
  async getStatusBreakdown() {
    try {
      const result = await query(`
        SELECT 
          status_resume,
          COUNT(*) as count
        FROM telkom_orders 
        WHERE status_resume IS NOT NULL
        GROUP BY status_resume 
        ORDER BY count DESC
      `);

      const breakdown = {};
      result.rows.forEach(row => {
        const status = row.status_resume.toUpperCase();
        if (status.includes('COMPLET') || status.includes('SUCCESS') || status.includes('SELESAI')) {
          breakdown.completed = (breakdown.completed || 0) + parseInt(row.count);
        } else if (status.includes('PENDING') || status.includes('WAIT')) {
          breakdown.pending = (breakdown.pending || 0) + parseInt(row.count);
        } else if (status.includes('PROGRESS') || status.includes('PROCESS')) {
          breakdown.in_progress = (breakdown.in_progress || 0) + parseInt(row.count);
        } else {
          breakdown.other = (breakdown.other || 0) + parseInt(row.count);
        }
      });

      return breakdown;
    } catch (error) {
      console.error('❌ Error getting status breakdown:', error);
      throw error;
    }
  }

  // Get detailed status breakdown
  async getDetailedStatusBreakdown() {
    try {
      const result = await query(`
        SELECT 
          UPPER(TRIM(status_resume)) as status,
          COUNT(*) as count
        FROM telkom_orders 
        WHERE status_resume IS NOT NULL AND TRIM(status_resume) != ''
        GROUP BY UPPER(TRIM(status_resume))
        ORDER BY count DESC
      `);

      const breakdown = {};
      result.rows.forEach(row => {
        breakdown[row.status] = parseInt(row.count);
      });

      return breakdown;
    } catch (error) {
      console.error('❌ Error getting detailed status breakdown:', error);
      throw error;
    }
  }

  // Get monthly trends
  async getMonthlyTrends() {
    try {
      const result = await query(`
        WITH monthly_data AS (
          SELECT 
            TO_CHAR(order_date, 'YYYY-MM') as month,
            COUNT(*) as order_count,
            COUNT(CASE WHEN status_resume IN ('COMPLETED', 'SUCCESS', 'SELESAI') THEN 1 END) as completed_count
          FROM telkom_orders 
          WHERE order_date >= CURRENT_DATE - INTERVAL '6 months'
          GROUP BY TO_CHAR(order_date, 'YYYY-MM')
          ORDER BY month DESC
        ),
        with_growth AS (
          SELECT 
            month,
            order_count,
            completed_count,
            LAG(order_count) OVER (ORDER BY month) as prev_order_count
          FROM monthly_data
        )
        SELECT 
          month,
          order_count,
          completed_count,
          CASE 
            WHEN prev_order_count IS NULL THEN 0
            ELSE ROUND((order_count - prev_order_count) * 100.0 / NULLIF(prev_order_count, 0), 1)
          END as growth_rate
        FROM with_growth
        ORDER BY month DESC
      `);

      return result.rows.map(row => ({
        month: row.month,
        order_count: parseInt(row.order_count),
        completed_count: parseInt(row.completed_count),
        growth_rate: parseFloat(row.growth_rate || 0)
      }));
    } catch (error) {
      console.error('❌ Error getting monthly trends:', error);
      throw error;
    }
  }

  // Get daily trends
  async getDailyTrends(days = 30) {
    try {
      const result = await query(`
        SELECT 
          order_date::date as order_date,
          COUNT(*) as order_count,
          COUNT(CASE WHEN status_resume IN ('COMPLETED', 'SUCCESS', 'SELESAI') THEN 1 END) as completed_count
        FROM telkom_orders 
        WHERE order_date >= CURRENT_DATE - INTERVAL '${days} days'
        GROUP BY order_date::date
        ORDER BY order_date DESC
      `);

      return result.rows.map(row => ({
        date: row.order_date,
        order_count: parseInt(row.order_count),
        completed_count: parseInt(row.completed_count)
      }));
    } catch (error) {
      console.error('❌ Error getting daily trends:', error);
      throw error;
    }
  }

  // Get city breakdown
  async getCityBreakdown() {
    try {
      const result = await query(`
        SELECT 
          city_name,
          witel,
          regional,
          COUNT(*) as order_count,
          ROUND(
            COUNT(CASE WHEN status_resume IN ('COMPLETED', 'SUCCESS', 'SELESAI') THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 1
          ) as completion_rate
        FROM telkom_orders 
        WHERE city_name IS NOT NULL
        GROUP BY city_name, witel, regional
        ORDER BY order_count DESC
      `);

      return result.rows.map(row => ({
        city_name: row.city_name,
        witel: row.witel,
        regional: row.regional,
        order_count: parseInt(row.order_count),
        completion_rate: parseFloat(row.completion_rate)
      }));
    } catch (error) {
      console.error('❌ Error getting city breakdown:', error);
      throw error;
    }
  }

  // Get geographic statistics
  async getGeographicStats() {
    try {
      const result = await query(`
        SELECT 
          COUNT(DISTINCT city_name) as total_cities,
          COUNT(DISTINCT CASE WHEN gps_latitude IS NOT NULL AND gps_longitude IS NOT NULL THEN city_name END) as cities_with_gps,
          AVG(gps_latitude) as average_latitude,
          AVG(gps_longitude) as average_longitude,
          MIN(gps_latitude) as min_latitude,
          MAX(gps_latitude) as max_latitude,
          MIN(gps_longitude) as min_longitude,
          MAX(gps_longitude) as max_longitude
        FROM telkom_orders
      `);

      const stats = result.rows[0];
      return {
        totalCities: parseInt(stats.total_cities),
        citiesWithGPS: parseInt(stats.cities_with_gps),
        averageLatitude: parseFloat(stats.average_latitude),
        averageLongitude: parseFloat(stats.average_longitude),
        latitudeRange: [parseFloat(stats.min_latitude), parseFloat(stats.max_latitude)],
        longitudeRange: [parseFloat(stats.min_longitude), parseFloat(stats.max_longitude)]
      };
    } catch (error) {
      console.error('❌ Error getting geographic stats:', error);
      throw error;
    }
  }

  // Get technical statistics
  async getTechnicalStats() {
    try {
      const result = await query(`
        SELECT 
          COUNT(DISTINCT CASE WHEN tech_id_1 IS NOT NULL THEN tech_id_1 END) as total_technicians_1,
          COUNT(DISTINCT CASE WHEN tech_id_2 IS NOT NULL THEN tech_id_2 END) as total_technicians_2,
          COUNT(CASE WHEN tech_id_1 IS NOT NULL AND tech_id_2 IS NOT NULL THEN 1 END) as two_tech_orders,
          COUNT(DISTINCT wfm_id) as total_wfm_tasks,
          ROUND(
            COUNT(CASE WHEN wfm_status IN ('COMPLETED', 'SUCCESS', 'DONE') THEN 1 END) * 100.0 / 
            NULLIF(COUNT(CASE WHEN wfm_status IS NOT NULL THEN 1 END), 0), 1
          ) as wfm_completion_rate,
          COUNT(DISTINCT crew_id) as total_crews
        FROM telkom_orders
      `);

      const installationTypes = await query(`
        SELECT 
          type_trans,
          COUNT(*) as count
        FROM telkom_orders 
        WHERE type_trans IS NOT NULL
        GROUP BY type_trans
        ORDER BY count DESC
        LIMIT 5
      `);

      const stats = result.rows[0];
      const totalTechnicians = parseInt(stats.total_technicians_1) + parseInt(stats.total_technicians_2);
      const totalOrders = await this.getQuickStats();

      return {
        totalTechnicians: totalTechnicians,
        twoTechOrders: parseInt(stats.two_tech_orders),
        totalWfmTasks: parseInt(stats.total_wfm_tasks),
        wfmCompletionRate: parseFloat(stats.wfm_completion_rate),
        totalCrews: parseInt(stats.total_crews),
        avgOrdersPerTech: totalTechnicians > 0 ? Math.round(totalOrders.totalOrders / totalTechnicians) : 0,
        installationTypes: installationTypes.rows.reduce((acc, row) => {
          acc[row.type_trans] = parseInt(row.count);
          return acc;
        }, {})
      };
    } catch (error) {
      console.error('❌ Error getting technical stats:', error);
      throw error;
    }
  }

  // Get revenue estimate
  async getRevenueEstimate() {
    try {
      const packages = await this.getPackageBreakdown();
      
      let totalRevenue = 0;
      packages.forEach(pkg => {
        totalRevenue += pkg.order_count * pkg.estimated_price;
      });

      const totalOrders = packages.reduce((sum, pkg) => sum + pkg.order_count, 0);
      const avgRevenuePerOrder = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

      // Calculate optimization potential based on completion rates
      const avgCompletionRate = packages.reduce((sum, pkg) => sum + pkg.success_rate, 0) / packages.length;
      const optimizationPotential = Math.round((100 - avgCompletionRate) * 0.8); // Conservative estimate

      return {
        totalRevenue,
        avgRevenuePerOrder,
        optimizationPotential,
        packageBreakdown: packages
      };
    } catch (error) {
      console.error('❌ Error getting revenue estimate:', error);
      throw error;
    }
  }

  // Get conversion statistics
  async getConversionStats() {
    try {
      const overallStats = await query(`
        SELECT 
          ROUND(
            COUNT(CASE WHEN status_resume IN ('COMPLETED', 'SUCCESS', 'SELESAI') THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 1
          ) as success_rate,
          ROUND(
            COUNT(CASE WHEN status_resume IN ('FAILED', 'CANCEL', 'GAGAL') THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 1
          ) as failure_rate,
          ROUND(
            COUNT(CASE WHEN status_resume IN ('PENDING', 'WAITING') THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 1
          ) as pending_rate
        FROM telkom_orders
      `);

      const bestRegional = await query(`
        SELECT 
          regional,
          ROUND(
            COUNT(CASE WHEN status_resume IN ('COMPLETED', 'SUCCESS', 'SELESAI') THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 1
          ) as success_rate
        FROM telkom_orders 
        WHERE regional IS NOT NULL
        GROUP BY regional
        HAVING COUNT(*) >= 100
        ORDER BY success_rate DESC
        LIMIT 1
      `);

      const worstRegional = await query(`
        SELECT 
          regional,
          ROUND(
            COUNT(CASE WHEN status_resume IN ('COMPLETED', 'SUCCESS', 'SELESAI') THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 1
          ) as success_rate
        FROM telkom_orders 
        WHERE regional IS NOT NULL
        GROUP BY regional
        HAVING COUNT(*) >= 100
        ORDER BY success_rate ASC
        LIMIT 1
      `);

      const bestWitel = await query(`
        SELECT 
          witel,
          ROUND(
            COUNT(CASE WHEN status_resume IN ('COMPLETED', 'SUCCESS', 'SELESAI') THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 1
          ) as success_rate
        FROM telkom_orders 
        WHERE witel IS NOT NULL
        GROUP BY witel
        HAVING COUNT(*) >= 50
        ORDER BY success_rate DESC
        LIMIT 1
      `);

      const bestPackage = await query(`
        SELECT 
          package_name,
          ROUND(
            COUNT(CASE WHEN status_resume IN ('COMPLETED', 'SUCCESS', 'SELESAI') THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 1
          ) as success_rate
        FROM telkom_orders 
        WHERE package_name IS NOT NULL
        GROUP BY package_name
        HAVING COUNT(*) >= 50
        ORDER BY success_rate DESC
        LIMIT 1
      `);

      const commonFailures = await query(`
        SELECT 
          status_message,
          COUNT(*) as count
        FROM telkom_orders 
        WHERE status_resume IN ('FAILED', 'CANCEL', 'GAGAL') 
          AND status_message IS NOT NULL
        GROUP BY status_message
        ORDER BY count DESC
        LIMIT 5
      `);

      return {
        overallSuccessRate: parseFloat(overallStats.rows[0]?.success_rate || 0),
        failureRate: parseFloat(overallStats.rows[0]?.failure_rate || 0),
        pendingRate: parseFloat(overallStats.rows[0]?.pending_rate || 0),
        bestRegional: bestRegional.rows[0] ? {
          regional: bestRegional.rows[0].regional,
          success_rate: parseFloat(bestRegional.rows[0].success_rate)
        } : null,
        worstRegional: worstRegional.rows[0] ? {
          regional: worstRegional.rows[0].regional,
          success_rate: parseFloat(worstRegional.rows[0].success_rate)
        } : null,
        bestWitel: bestWitel.rows[0] ? {
          witel: bestWitel.rows[0].witel,
          success_rate: parseFloat(bestWitel.rows[0].success_rate)
        } : null,
        bestPackage: bestPackage.rows[0] ? {
          package_name: bestPackage.rows[0].package_name,
          success_rate: parseFloat(bestPackage.rows[0].success_rate)
        } : null,
        commonFailures: commonFailures.rows.map(row => row.status_message)
      };
    } catch (error) {
      console.error('❌ Error getting conversion stats:', error);
      throw error;
    }
  }

  // Get dashboard data for BrightInsight
  async getDashboardData(timeRange = '7d', regional = null, witel = null) {
    try {
      const timeCondition = this.getTimeCondition(timeRange);
      const regionalCondition = regional ? `AND regional = $2` : '';
      const witelCondition = witel ? `AND witel = $${regional ? 3 : 2}` : '';
      
      const params = [timeCondition];
      if (regional) params.push(regional);
      if (witel) params.push(witel);

      // Main statistics
      const stats = await query(`
        SELECT 
          COUNT(*) as total_orders,
          COUNT(CASE WHEN status_resume IN ('COMPLETED', 'SUCCESS', 'SELESAI') THEN 1 END) as completed_orders,
          COUNT(CASE WHEN status_resume IN ('PENDING', 'WAITING') THEN 1 END) as pending_orders,
          COUNT(CASE WHEN status_resume IN ('FAILED', 'CANCEL', 'GAGAL') THEN 1 END) as failed_orders,
          COUNT(DISTINCT customer_name) as unique_customers,
          ROUND(AVG(EXTRACT(EPOCH FROM (last_updated_date - order_date))/3600), 2) as avg_completion_hours
        FROM telkom_orders 
        WHERE order_date >= CURRENT_DATE - INTERVAL '${timeCondition}' 
        ${regionalCondition} ${witelCondition}
      `, params.slice(1));

      // Hourly breakdown for chart
      const hourlyData = await query(`
        SELECT 
          EXTRACT(HOUR FROM order_date) as hour,
          COUNT(*) as order_count,
          COUNT(CASE WHEN status_resume IN ('COMPLETED', 'SUCCESS', 'SELESAI') THEN 1 END) as completed_count
        FROM telkom_orders 
        WHERE order_date >= CURRENT_DATE - INTERVAL '${timeCondition}'
        ${regionalCondition} ${witelCondition}
        GROUP BY EXTRACT(HOUR FROM order_date)
        ORDER BY hour
      `, params.slice(1));

      // Top products
      const topProducts = await query(`
        SELECT 
          COALESCE(package_name, 'Unknown') as package_name,
          COUNT(*) as order_count,
          COUNT(CASE WHEN status_resume IN ('COMPLETED', 'SUCCESS', 'SELESAI') THEN 1 END) as completed_count,
          ROUND(
            COUNT(CASE WHEN status_resume IN ('COMPLETED', 'SUCCESS', 'SELESAI') THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 1
          ) as success_rate
        FROM telkom_orders 
        WHERE order_date >= CURRENT_DATE - INTERVAL '${timeCondition}'
        ${regionalCondition} ${witelCondition}
        GROUP BY package_name
        ORDER BY order_count DESC
        LIMIT 10
      `, params.slice(1));

      // Geographic data
      const geoData = await query(`
        SELECT 
          COALESCE(regional, 'Unknown') as regional,
          COUNT(*) as order_count,
          ROUND(
            COUNT(CASE WHEN status_resume IN ('COMPLETED', 'SUCCESS', 'SELESAI') THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 1
          ) as completion_rate
        FROM telkom_orders 
        WHERE order_date >= CURRENT_DATE - INTERVAL '${timeCondition}'
        ${witelCondition}
        GROUP BY regional
        ORDER BY order_count DESC
        LIMIT 10
      `, witel ? [witel] : []);

      return {
        stats: stats.rows[0],
        hourlyData: hourlyData.rows,
        topProducts: topProducts.rows,
        geoData: geoData.rows,
        timeRange,
        filters: { regional, witel }
      };

    } catch (error) {
      console.error('❌ Error getting dashboard data:', error);
      throw error;
    }
  }

  // Get realtime data simulation
  async getRealtimeData() {
    try {
      const result = await query(`
        SELECT 
          COUNT(CASE WHEN order_date::date = CURRENT_DATE THEN 1 END) as today_orders,
          COUNT(CASE WHEN order_date >= CURRENT_TIMESTAMP - INTERVAL '1 hour' THEN 1 END) as last_hour_orders,
          COUNT(CASE WHEN last_updated_date >= CURRENT_TIMESTAMP - INTERVAL '5 minutes' THEN 1 END) as recent_updates,
          COUNT(CASE WHEN status_resume IN ('PENDING', 'WAITING') THEN 1 END) as active_orders
        FROM telkom_orders
      `);

      // Simulate real-time hourly data for today
      const hourlyToday = await query(`
        SELECT 
          EXTRACT(HOUR FROM order_date) as hour,
          COUNT(*) as orders,
          COUNT(CASE WHEN status_resume IN ('COMPLETED', 'SUCCESS', 'SELESAI') THEN 1 END) as completed
        FROM telkom_orders 
        WHERE order_date::date = CURRENT_DATE
        GROUP BY EXTRACT(HOUR FROM order_date)
        ORDER BY hour
      `);

      return {
        liveStats: result.rows[0],
        hourlyToday: hourlyToday.rows,
        lastUpdate: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Error getting realtime data:', error);
      throw error;
    }
  }

  // Helper method to get time condition
  getTimeCondition(timeRange) {
    switch (timeRange) {
      case '1d': return '1 day';
      case '7d': return '7 days';
      case '30d': return '30 days';
      case '90d': return '90 days';
      default: return '7 days';
    }
  }

  // Get all orders with pagination and filters (from original code)
  static async getOrders(page = 1, limit = 50, filters = {}) {
    const offset = (page - 1) * limit;
    let whereClause = 'WHERE 1=1';
    let queryParams = [];
    let paramCount = 1;

    // Add filters
    if (filters.regional) {
      whereClause += ` AND regional = ${paramCount}`;
      queryParams.push(filters.regional);
      paramCount++;
    }

    if (filters.witel) {
      whereClause += ` AND witel = ${paramCount}`;
      queryParams.push(filters.witel);
      paramCount++;
    }

    if (filters.status_resume) {
      whereClause += ` AND status_resume = ${paramCount}`;
      queryParams.push(filters.status_resume);
      paramCount++;
    }

    if (filters.city_name) {
      whereClause += ` AND city_name ILIKE ${paramCount}`;
      queryParams.push(`%${filters.city_name}%`);
      paramCount++;
    }

    if (filters.date_from) {
      whereClause += ` AND order_date >= ${paramCount}`;
      queryParams.push(filters.date_from);
      paramCount++;
    }

    if (filters.date_to) {
      whereClause += ` AND order_date <= ${paramCount}`;
      queryParams.push(filters.date_to);
      paramCount++;
    }

    queryParams.push(limit, offset);

    const queryText = `
      SELECT * FROM telkom_orders 
      ${whereClause}
      ORDER BY order_date DESC, created_at DESC 
      LIMIT ${paramCount} OFFSET ${paramCount + 1}
    `;

    const countQuery = `
      SELECT COUNT(*) FROM telkom_orders ${whereClause}
    `;

    try {
      const [result, countResult] = await Promise.all([
        query(queryText, queryParams),
        query(countQuery, queryParams.slice(0, -2))
      ]);

      return {
        data: result.rows,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(countResult.rows[0].count / limit),
          totalRows: parseInt(countResult.rows[0].count),
          limit: parseInt(limit)
        }
      };
    } catch (error) {
      console.error('❌ Error fetching orders:', error);
      throw error;
    }
  }

  // Search orders with filters
  async searchOrders(filters = {}) {
    try {
      let conditions = ['1=1'];
      let params = [];
      let paramCount = 0;

      if (filters.regional) {
        paramCount++;
        conditions.push(`regional = ${paramCount}`);
        params.push(filters.regional);
      }

      if (filters.witel) {
        paramCount++;
        conditions.push(`witel = ${paramCount}`);
        params.push(filters.witel);
      }

      if (filters.status) {
        paramCount++;
        conditions.push(`status_resume = ${paramCount}`);
        params.push(filters.status);
      }

      if (filters.package_name) {
        paramCount++;
        conditions.push(`package_name ILIKE ${paramCount}`);
        params.push(`%${filters.package_name}%`);
      }

      if (filters.city) {
        paramCount++;
        conditions.push(`city_name ILIKE ${paramCount}`);
        params.push(`%${filters.city}%`);
      }

      if (filters.date_from) {
        paramCount++;
        conditions.push(`order_date >= ${paramCount}`);
        params.push(filters.date_from);
      }

      if (filters.date_to) {
        paramCount++;
        conditions.push(`order_date <= ${paramCount}`);
        params.push(filters.date_to);
      }

      const limit = filters.limit || 1000;
      const offset = filters.offset || 0;

      paramCount++;
      params.push(limit);
      paramCount++;
      params.push(offset);

      const query_text = `
        SELECT 
          order_id,
          regional,
          witel,
          city_name,
          package_name,
          status_resume,
          order_date,
          customer_name,
          contact_hp,
          last_updated_date
        FROM telkom_orders 
        WHERE ${conditions.join(' AND ')}
        ORDER BY order_date DESC
        LIMIT ${paramCount - 1} OFFSET ${paramCount}
      `;

      const result = await query(query_text, params);

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM telkom_orders 
        WHERE ${conditions.join(' AND ')}
      `;
      const countResult = await query(countQuery, params.slice(0, -2));

      return {
        orders: result.rows,
        total: parseInt(countResult.rows[0].total),
        limit,
        offset
      };

    } catch (error) {
      console.error('❌ Error searching orders:', error);
      throw error;
    }
  }

  // Get order details by ID
  async getOrderById(orderId) {
    try {
      const result = await query(`
        SELECT * FROM telkom_orders 
        WHERE order_id = $1 OR extern_order_id = $1
        LIMIT 1
      `, [orderId]);

      return result.rows[0] || null;
    } catch (error) {
      console.error('❌ Error getting order by ID:', error);
      throw error;
    }
  }

  // Update order status
  async updateOrderStatus(orderId, newStatus, statusMessage = null) {
    try {
      const result = await query(`
        UPDATE telkom_orders 
        SET 
          status_resume = $2,
          status_message = COALESCE($3, status_message),
          last_updated_date = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE order_id = $1 OR extern_order_id = $1
        RETURNING *
      `, [orderId, newStatus, statusMessage]);

      return result.rows[0] || null;
    } catch (error) {
      console.error('❌ Error updating order status:', error);
      throw error;
    }
  }

  // Get performance metrics for specific period
  async getPerformanceMetrics(startDate, endDate) {
    try {
      const result = await query(`
        SELECT 
          COUNT(*) as total_orders,
          COUNT(CASE WHEN status_resume IN ('COMPLETED', 'SUCCESS', 'SELESAI') THEN 1 END) as completed_orders,
          COUNT(CASE WHEN status_resume IN ('PENDING', 'WAITING') THEN 1 END) as pending_orders,
          COUNT(CASE WHEN status_resume IN ('FAILED', 'CANCEL', 'GAGAL') THEN 1 END) as failed_orders,
          COUNT(DISTINCT regional) as active_regions,
          COUNT(DISTINCT witel) as active_witels,
          COUNT(DISTINCT package_name) as package_types,
          ROUND(AVG(EXTRACT(EPOCH FROM (last_updated_date - order_date))/3600), 2) as avg_completion_hours,
          ROUND(
            COUNT(CASE WHEN status_resume IN ('COMPLETED', 'SUCCESS', 'SELESAI') THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 2
          ) as completion_rate
        FROM telkom_orders 
        WHERE order_date BETWEEN $1 AND $2
      `, [startDate, endDate]);

      return result.rows[0];
    } catch (error) {
      console.error('❌ Error getting performance metrics:', error);
      throw error;
    }
  }

  // Get available filters for frontend
  async getAvailableFilters() {
    try {
      const regional = await query(`
        SELECT DISTINCT regional 
        FROM telkom_orders 
        WHERE regional IS NOT NULL 
        ORDER BY regional
      `);

      const witel = await query(`
        SELECT DISTINCT witel, regional 
        FROM telkom_orders 
        WHERE witel IS NOT NULL 
        ORDER BY regional, witel
      `);

      const cities = await query(`
        SELECT DISTINCT city_name, witel, regional 
        FROM telkom_orders 
        WHERE city_name IS NOT NULL 
        ORDER BY regional, witel, city_name
        LIMIT 500
      `);

      const packages = await query(`
        SELECT DISTINCT package_name 
        FROM telkom_orders 
        WHERE package_name IS NOT NULL 
        ORDER BY package_name
      `);

      const statuses = await query(`
        SELECT DISTINCT status_resume 
        FROM telkom_orders 
        WHERE status_resume IS NOT NULL 
        ORDER BY status_resume
      `);

      return {
        regional: regional.rows.map(r => r.regional),
        witel: witel.rows,
        cities: cities.rows,
        packages: packages.rows.map(p => p.package_name),
        statuses: statuses.rows.map(s => s.status_resume)
      };
    } catch (error) {
      console.error('❌ Error getting available filters:', error);
      throw error;
    }
  }

  // Export data to CSV format (returns data, not file)
  async exportData(filters = {}) {
    try {
      const searchResult = await this.searchOrders({
        ...filters,
        limit: 10000, // Max export limit
        offset: 0
      });

      const csvHeaders = [
        'ORDER_ID', 'REGIONAL', 'WITEL', 'CITY_NAME', 'PACKAGE_NAME',
        'STATUS_RESUME', 'ORDER_DATE', 'CUSTOMER_NAME', 'CONTACT_HP',
        'LAST_UPDATED_DATE'
      ];

      const csvData = searchResult.orders.map(order => [
        order.order_id,
        order.regional,
        order.witel,
        order.city_name,
        order.package_name,
        order.status_resume,
        order.order_date,
        order.customer_name,
        order.contact_hp,
        order.last_updated_date
      ]);

      return {
        headers: csvHeaders,
        data: csvData,
        totalRecords: searchResult.total
      };
    } catch (error) {
      console.error('❌ Error exporting data:', error);
      throw error;
    }
  }

  // Get jenispsb composition analysis
  async getJenisPsbComposition() {
    try {
      const result = await query(`
        SELECT 
          jenispsb,
          COUNT(*) as order_count,
          ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM telkom_orders), 2) as percentage,
          ROUND(
            COUNT(CASE WHEN status_resume IN ('COMPLETED', 'SUCCESS', 'SELESAI') THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 1
          ) as completion_rate,
          ROUND(
            AVG(EXTRACT(DAY FROM (last_updated_date - order_date))), 1
          ) as avg_processing_days
        FROM telkom_orders 
        WHERE jenispsb IS NOT NULL
        GROUP BY jenispsb
        ORDER BY order_count DESC
      `);

      return result.rows.map(row => ({
        jenispsb: row.jenispsb,
        order_count: parseInt(row.order_count),
        percentage: parseFloat(row.percentage),
        completion_rate: parseFloat(row.completion_rate),
        avg_processing_days: parseFloat(row.avg_processing_days) || 0
      }));
    } catch (error) {
      console.error('❌ Error getting jenispsb composition:', error);
      throw error;
    }
  }

  // Get top and bottom performing witels
  async getWitelLeaderboard() {
    try {
      const result = await query(`
        SELECT 
          witel,
          regional,
          COUNT(*) as total_orders,
          ROUND(
            COUNT(CASE WHEN status_resume IN ('COMPLETED', 'SUCCESS', 'SELESAI') THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 1
          ) as completion_rate,
          ROUND(
            COUNT(CASE WHEN jenispsb = 'DO' THEN 1 END) * 100.0 / 
            NULLIF(COUNT(CASE WHEN jenispsb = 'AO' THEN 1 END), 0), 1
          ) as churn_to_sales_ratio,
          ROUND(
            AVG(EXTRACT(DAY FROM (last_updated_date - order_date))), 1
          ) as avg_processing_days,
          COUNT(CASE WHEN jenispsb = 'AO' THEN 1 END) as activation_orders
        FROM telkom_orders 
        WHERE witel IS NOT NULL
        GROUP BY witel, regional
        HAVING COUNT(*) >= 10
        ORDER BY completion_rate DESC
      `);

      const allWitels = result.rows.map(row => ({
        witel: row.witel,
        regional: row.regional,
        total_orders: parseInt(row.total_orders),
        completion_rate: parseFloat(row.completion_rate),
        churn_to_sales_ratio: parseFloat(row.churn_to_sales_ratio) || 0,
        avg_processing_days: parseFloat(row.avg_processing_days) || 0,
        activation_orders: parseInt(row.activation_orders)
      }));

      return {
        top_10: allWitels.slice(0, 10),
        bottom_10: allWitels.slice(-10).reverse()
      };
    } catch (error) {
      console.error('❌ Error getting witel leaderboard:', error);
      throw error;
    }
  }

  // Get jenispsb analysis by hierarchy (Regional -> Witel -> Datel)
  async getJenisPsbByHierarchy() {
    try {
      const result = await query(`
        SELECT 
          regional,
          witel,
          datel,
          jenispsb,
          COUNT(*) as order_count,
          ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(PARTITION BY regional, witel, datel), 2) as percentage_in_area,
          ROUND(
            COUNT(CASE WHEN status_resume IN ('COMPLETED', 'SUCCESS', 'SELESAI') THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 1
          ) as success_rate,
          ROUND(
            AVG(EXTRACT(DAY FROM (last_updated_date - order_date))), 1
          ) as avg_processing_days
        FROM telkom_orders 
        WHERE jenispsb IS NOT NULL 
          AND regional IS NOT NULL 
          AND witel IS NOT NULL 
          AND datel IS NOT NULL
        GROUP BY regional, witel, datel, jenispsb
        ORDER BY regional, witel, datel, order_count DESC
      `);

      return result.rows.map(row => ({
        regional: row.regional,
        witel: row.witel,
        datel: row.datel,
        jenispsb: row.jenispsb,
        order_count: parseInt(row.order_count),
        percentage_in_area: parseFloat(row.percentage_in_area),
        success_rate: parseFloat(row.success_rate),
        avg_processing_days: parseFloat(row.avg_processing_days) || 0
      }));
    } catch (error) {
      console.error('❌ Error getting jenispsb by hierarchy:', error);
      throw error;
    }
  }

  // Get processing time analysis (< 3 days vs > 3 days)
  async getProcessingTimeAnalysis() {
    try {
      const result = await query(`
        WITH processing_analysis AS (
          SELECT 
            regional,
            witel,
            datel,
            jenispsb,
            EXTRACT(DAY FROM (last_updated_date - order_date)) as processing_days,
            CASE 
              WHEN EXTRACT(DAY FROM (last_updated_date - order_date)) <= 3 THEN 'Fast (≤3 days)'
              WHEN EXTRACT(DAY FROM (last_updated_date - order_date)) <= 7 THEN 'Medium (4-7 days)'
              ELSE 'Slow (>7 days)'
            END as processing_category,
            status_resume
          FROM telkom_orders 
          WHERE last_updated_date IS NOT NULL 
            AND order_date IS NOT NULL
            AND last_updated_date >= order_date
        )
        SELECT 
          regional,
          witel,
          datel,
          jenispsb,
          processing_category,
          COUNT(*) as order_count,
          ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(PARTITION BY regional, witel, datel), 2) as percentage,
          ROUND(AVG(processing_days), 1) as avg_days,
          COUNT(CASE WHEN status_resume IN ('COMPLETED', 'SUCCESS', 'SELESAI') THEN 1 END) as completed_orders
        FROM processing_analysis
        GROUP BY regional, witel, datel, jenispsb, processing_category
        ORDER BY regional, witel, datel, order_count DESC
      `);

      return result.rows.map(row => ({
        regional: row.regional,
        witel: row.witel,
        datel: row.datel,
        jenispsb: row.jenispsb,
        processing_category: row.processing_category,
        order_count: parseInt(row.order_count),
        percentage: parseFloat(row.percentage),
        avg_days: parseFloat(row.avg_days),
        completed_orders: parseInt(row.completed_orders)
      }));
    } catch (error) {
      console.error('❌ Error getting processing time analysis:', error);
      throw error;
    }
  }

  // Get high-risk processing alerts (> 3 days)
  async getProcessingRiskAlerts() {
    try {
      const result = await query(`
        SELECT 
          regional,
          witel,
          datel,
          jenispsb,
          COUNT(*) as risk_orders,
          ROUND(AVG(EXTRACT(DAY FROM (last_updated_date - order_date))), 1) as avg_processing_days,
          COUNT(CASE WHEN status_resume IN ('COMPLETED', 'SUCCESS', 'SELESAI') THEN 1 END) as completed_despite_delay,
          ROUND(
            COUNT(CASE WHEN status_resume IN ('COMPLETED', 'SUCCESS', 'SELESAI') THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 1
          ) as completion_rate_despite_delay
        FROM telkom_orders 
        WHERE EXTRACT(DAY FROM (last_updated_date - order_date)) > 3
          AND last_updated_date IS NOT NULL 
          AND order_date IS NOT NULL
          AND regional IS NOT NULL
        GROUP BY regional, witel, datel, jenispsb
        HAVING COUNT(*) >= 5  -- Only show areas with significant risk volume
        ORDER BY avg_processing_days DESC, risk_orders DESC
      `);

      return result.rows.map(row => ({
        regional: row.regional,
        witel: row.witel,
        datel: row.datel,
        jenispsb: row.jenispsb,
        risk_orders: parseInt(row.risk_orders),
        avg_processing_days: parseFloat(row.avg_processing_days),
        completed_despite_delay: parseInt(row.completed_despite_delay),
        completion_rate_despite_delay: parseFloat(row.completion_rate_despite_delay),
        risk_level: row.avg_processing_days > 7 ? 'HIGH' : 'MEDIUM'
      }));
    } catch (error) {
      console.error('❌ Error getting processing risk alerts:', error);
      throw error;
    }
  }

  // Get jenispsb champions by area (best performing areas for each transaction type)
  async getJenisPsbChampions() {
    try {
      const result = await query(`
        WITH jenispsb_performance AS (
          SELECT 
            regional,
            witel,
            datel,
            jenispsb,
            COUNT(*) as order_count,
            ROUND(
              COUNT(CASE WHEN status_resume IN ('COMPLETED', 'SUCCESS', 'SELESAI') THEN 1 END) * 100.0 / 
              NULLIF(COUNT(*), 0), 1
            ) as success_rate,
            ROUND(
              AVG(EXTRACT(DAY FROM (last_updated_date - order_date))), 1
            ) as avg_processing_days
          FROM telkom_orders 
          WHERE jenispsb IS NOT NULL
          GROUP BY regional, witel, datel, jenispsb
          HAVING COUNT(*) >= 10  -- Minimum volume for statistical significance
        ),
        ranked_performance AS (
          SELECT 
            *,
            ROW_NUMBER() OVER(
              PARTITION BY jenispsb 
              ORDER BY success_rate DESC, avg_processing_days ASC
            ) as rank
          FROM jenispsb_performance
        )
        SELECT 
          jenispsb,
          regional,
          witel,
          datel,
          order_count,
          success_rate,
          avg_processing_days
        FROM ranked_performance
        WHERE rank <= 3  -- Top 3 performers for each jenispsb
        ORDER BY jenispsb, rank
      `);

      return result.rows.map(row => ({
        jenispsb: row.jenispsb,
        regional: row.regional,
        witel: row.witel,
        datel: row.datel,
        order_count: parseInt(row.order_count),
        success_rate: parseFloat(row.success_rate),
        avg_processing_days: parseFloat(row.avg_processing_days)
      }));
    } catch (error) {
      console.error('❌ Error getting jenispsb champions:', error);
      throw error;
    }
  }

  // Get database health and statistics
  async getDatabaseHealth() {
    try {
      const tableStats = await query(`
        SELECT 
          COUNT(*) as total_records,
          COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as today_records,
          COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as week_records,
          MIN(order_date) as earliest_order,
          MAX(order_date) as latest_order,
          COUNT(CASE WHEN regional IS NULL THEN 1 END) as missing_regional,
          COUNT(CASE WHEN witel IS NULL THEN 1 END) as missing_witel,
          COUNT(CASE WHEN status_resume IS NULL THEN 1 END) as missing_status,
          COUNT(CASE WHEN jenispsb IS NULL THEN 1 END) as missing_jenispsb,
        COUNT(CASE WHEN datel IS NULL THEN 1 END) as missing_datel,
        COUNT(CASE WHEN EXTRACT(DAY FROM (last_updated_date - order_date)) > 3 THEN 1 END) as slow_processing_orders,
        ROUND(
          COUNT(CASE WHEN EXTRACT(DAY FROM (last_updated_date - order_date)) <= 3 THEN 1 END) * 100.0 / 
          NULLIF(COUNT(CASE WHEN last_updated_date IS NOT NULL AND order_date IS NOT NULL THEN 1 END), 0), 1
        ) as fast_processing_percentage
        FROM telkom_orders
      `);

      const indexStats = await query(`
        SELECT 
          schemaname,
          tablename,
          indexname,
          indexdef
        FROM pg_indexes 
        WHERE tablename = 'telkom_orders'
        ORDER BY indexname
      `);

      const tableSize = await query(`
        SELECT 
          pg_size_pretty(pg_total_relation_size('telkom_orders')) as total_size,
          pg_size_pretty(pg_relation_size('telkom_orders')) as table_size
      `);

      return {
        stats: tableStats.rows[0],
        indexes: indexStats.rows,
        size: tableSize.rows[0],
        health: 'good', // Can be enhanced with more health checks
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error getting database health:', error);
      throw error;
    }
  }

  // Get analytics data (from original code)
  static async getAnalytics(dateRange = '30') {
    const dateClause = dateRange === 'all' ? '' : `WHERE order_date >= CURRENT_DATE - INTERVAL '${dateRange} days'`;

    const queries = {
      // Total orders
      totalOrders: `SELECT COUNT(*) as total FROM telkom_orders ${dateClause}`,
      
      // Orders by status
      ordersByStatus: `
        SELECT status_resume, COUNT(*) as count 
        FROM telkom_orders ${dateClause}
        GROUP BY status_resume 
        ORDER BY count DESC
      `,
      
      // Orders by regional
      ordersByRegional: `
        SELECT regional, COUNT(*) as count 
        FROM telkom_orders ${dateClause}
        GROUP BY regional 
        ORDER BY count DESC
      `,
      
      // Orders by package
      ordersByPackage: `
        SELECT package_name, COUNT(*) as count 
        FROM telkom_orders ${dateClause}
        WHERE package_name IS NOT NULL
        GROUP BY package_name 
        ORDER BY count DESC 
        LIMIT 10
      `,
      
      // Daily orders trend
      dailyTrend: `
        SELECT 
          DATE(order_date) as date,
          COUNT(*) as orders
        FROM telkom_orders 
        WHERE order_date >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY DATE(order_date)
        ORDER BY date
      `,
      
      // Top cities
      topCities: `
        SELECT city_name, COUNT(*) as count 
        FROM telkom_orders ${dateClause}
        WHERE city_name IS NOT NULL
        GROUP BY city_name 
        ORDER BY count DESC 
        LIMIT 10
      `
    };

    try {
      const results = {};
      
      for (const [key, queryText] of Object.entries(queries)) {
        const result = await query(queryText);
        results[key] = result.rows;
      }

      return results;
    } catch (error) {
      console.error('❌ Error fetching analytics:', error);
      throw error;
    }
  }

  // Insert new order (from original code)
  static async insertOrder(orderData) {
    const columns = Object.keys(orderData).join(', ');
    const placeholders = Object.keys(orderData).map((_, index) => `${index + 1}`).join(', ');
    const values = Object.values(orderData);

    const queryText = `
      INSERT INTO telkom_orders (${columns}) 
      VALUES (${placeholders}) 
      RETURNING *
    `;

    try {
      const result = await query(queryText, values);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error inserting order:', error);
      throw error;
    }
  }

  // Bulk insert orders (for CSV import, from original code)
  static async bulkInsert(orders) {
    const { pool } = require('../config/database');
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const insertPromises = orders.map(order => {
        const columns = Object.keys(order).join(', ');
        const placeholders = Object.keys(order).map((_, index) => `${index + 1}`).join(', ');
        const values = Object.values(order);

        const queryText = `
          INSERT INTO telkom_orders (${columns}) 
          VALUES (${placeholders}) 
          ON CONFLICT (order_id) DO UPDATE SET
            updated_at = CURRENT_TIMESTAMP
        `;

        return client.query(queryText, values);
      });

      await Promise.all(insertPromises);
      await client.query('COMMIT');
      
      return { success: true, inserted: orders.length };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Error bulk inserting orders:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = new TelkomOrderModel();