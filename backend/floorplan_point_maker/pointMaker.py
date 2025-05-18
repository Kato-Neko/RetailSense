import cv2
import numpy as np
import os

# --- Configuration for paths ---
# Get the directory where the script is located
script_dir = os.path.dirname(os.path.abspath(__file__))

# Define the input image name and the output file name
input_image_filename = "floorplan.png"  # You can change this if needed
output_points_filename = "floorplan_points.txt"

# Construct full paths relative to the script's location
# Assumes "Sample Images" and "Points" are in the project root directory (two levels up from this script)
input_image_path = os.path.join(script_dir, "..", "..", "Images", "Sample Images", input_image_filename)
output_dir = os.path.join(script_dir, "..", "..", "Points")
output_points_path = os.path.join(output_dir, output_points_filename)

# Load the floorplan image
print(f"DEBUG: Attempting to load image from absolute path: {os.path.abspath(input_image_path)}")
print(f"DEBUG: Does the OS report file exists at this path? {os.path.exists(os.path.abspath(input_image_path))}")
floorplan = cv2.imread(input_image_path)
assert floorplan is not None, (
    f"Error loading floorplan image from {os.path.abspath(input_image_path)}. "
    "Please verify the following:\n"
    "1. The file exists at this exact path.\n"
    "2. There are no typos in the path or filename.\n"
    "3. The file is a valid, uncorrupted image (e.g., .png, .jpg).\n"
    "4. The script has read permissions for the file."
)

# List to store points
points = []
instructions = [
    "Select the **Bottom-left corner** of the FOV",
    "Select the **Bottom-right corner** of the FOV",
    "Select the **Top-right corner** of the FOV",
    "Select the **Top-left corner** of the FOV"
]

# Mouse callback function
def select_points(event, x, y, flags, param):
    if event == cv2.EVENT_LBUTTONDOWN:  # Left mouse button click
        points.append((x, y))
        print(f"Point selected: ({x}, {y})")
        # Draw a circle at the selected point
        cv2.circle(floorplan, (x, y), 5, (0, 0, 255), -1)
        cv2.imshow("Floorplan", floorplan)

# Display the floorplan and set the mouse callback
cv2.imshow("Floorplan", floorplan)
cv2.setMouseCallback("Floorplan", select_points)

print("Click on the floorplan to select points for each camera's FOV in the following order:")
for i, instruction in enumerate(instructions, start=1):
    print(f"{i}. {instruction}")

print("\nPress 'q' to finish selecting points.")
cv2.waitKey(0)
cv2.destroyAllWindows()

# Print the selected points
print("Selected points (in order):", points)

# Ensure the output directory exists
os.makedirs(output_dir, exist_ok=True)

# Save the points to a file (optional)
np.savetxt(output_points_path, points, fmt="%d", header="x y")
print(f"Selected points saved to: {output_points_path}")