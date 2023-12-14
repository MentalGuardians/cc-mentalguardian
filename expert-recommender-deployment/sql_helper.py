import pandas as pd
from sqlalchemy import create_engine

# Replace 'mysql://username:@localhost:3306/database' with your database connection string
# Note the empty string between 'username:' and '@'
db_url = "mysql://root:@localhost:3306/test"
engine = create_engine(db_url)

# Read data from CSV file
csv_file_path = "./Mental_Health.csv"
data = pd.read_csv(csv_file_path)

# Replace 'your_table_name' with the name of your database table
table_name = "therapists_table"

# Send data to the database
data.to_sql(table_name, engine, if_exists="replace", index=False)

# Close the database connection
engine.dispose()
