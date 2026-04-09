INSERT INTO documents (file_name, file_path, file_type)
VALUES
    ('Humidity-Induced.docx', 'data/documents/Humidity-Induced.docx', 'docx'),
    ('ai_document_classification.txt', 'data/documents/ai_document_classification.txt', 'txt'),
    ('aircraft_performance.txt', 'data/documents/aircraft_performance.txt', 'txt'),
    ('cybersecurity_incident.txt', 'data/documents/cybersecurity_incident.txt', 'txt'),
    ('engine_maintenance.txt', 'data/documents/engine_maintenance.txt', 'txt'),
    ('engineering_report.txt', 'data/documents/engineering_report.txt', 'txt'),
    ('materials_and_corrosion.txt', 'data/documents/materials_and_corrosion.txt', 'txt'),
    ('network_routing_failure.pdf', 'data/documents/network_routing_failure.pdf', 'pdf'),
    ('radar_systems.txt', 'data/documents/radar_systems.txt', 'txt'),
    ('renewable_energy_project.txt', 'data/documents/renewable_energy_project.txt', 'txt'),
    ('safety_inspection.docx', 'data/documents/safety_inspection.docx', 'docx'),
    ('satellite_communications.txt', 'data/documents/satellite_communications.txt', 'txt'),
    ('sensor_calibration.txt', 'data/documents/sensor_calibration.txt', 'txt'),
    ('supply_chain_logistics.txt', 'data/documents/supply_chain_logistics.txt', 'txt')
ON CONFLICT (file_name) DO NOTHING;
