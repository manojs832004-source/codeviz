class Node:
    def __init__(self, value, prob):
        self.value = value
        self.probability = prob
        self.left = None
        self.right = None

def build_prob_tree(depth, current_prob=1.0):
    if depth == 0:
        return None
    
    node = Node(f"Depth {depth}", current_prob)
    
    # 50/50 chance for left and right
    node.left = build_prob_tree(depth - 1, current_prob * 0.5)
    node.right = build_prob_tree(depth - 1, current_prob * 0.5)
    
    return node

print("Enter the depth of the probability tree (e.g. 3 or 4):")
try:
    # Read depth from custom stdin
    depth_str = input()
    depth = int(depth_str.strip())
    print(f"Building a binary tree of depth {depth}...")
    
    root = build_prob_tree(depth)
    
    print("Tree built successfully! Check the GraphViewer to explore it.")
except Exception as e:
    print(f"Error reading input or building tree: {e}")
