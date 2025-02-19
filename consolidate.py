import pandas as pd
import glob
import os

dataset_path = "/Users/riajuneja/physionet.org/files/wearable-exam-stress/1.0.0/data/"

# Find all student folders (S1, S2, S3, ...)
student_folders = glob.glob(f"{dataset_path}/S*")
all_data = []
exam_sessions = ["Final", "midterm_1", "midterm_2"]

# Iterate through each student folder
for student in student_folders:
    student_id = os.path.basename(student)  # Extract student ID (e.g., S1, S2)

    # Iterate through each exam session
    for session in exam_sessions:
        session_path = os.path.join(student, session)

        eda_path = os.path.join(session_path, "eda.csv")
        hr_path = os.path.join(session_path, "hr.csv")
        temp_path = os.path.join(session_path, "temp.csv")

        # Load data only if all required files exist
        if os.path.exists(eda_path) and os.path.exists(hr_path) and os.path.exists(temp_path):
            eda_df = pd.read_csv(eda_path, header=None, names=["EDA"])
            hr_df = pd.read_csv(hr_path, header=None, names=["Heart Rate"])
            temp_df = pd.read_csv(temp_path, header=None, names=["Temperature"])

            # Ensure all dataframes have the same length
            min_length = min(len(eda_df), len(hr_df), len(temp_df))
            eda_df, hr_df, temp_df = eda_df[:min_length], hr_df[:min_length], temp_df[:min_length]

            merged_df = pd.DataFrame({
                "Time (Index)": range(min_length),
                "EDA": eda_df["EDA"].values,
                "Heart Rate": hr_df["Heart Rate"].values,
                "Temperature": temp_df["Temperature"].values,
                "Student": student_id,
                "Session": session  
            })

            all_data.append(merged_df)

final_df = pd.concat(all_data, ignore_index=True)

final_df.to_csv("consolidated_stress_data.csv", index=False)

print("✅ Merged dataset saved as consolidated_stress_data.csv")
